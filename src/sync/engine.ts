/**
 * SIGEN · Motor de sincronização com a base de dados partilhada (Supabase).
 *
 * Este ficheiro é IDÊNTICO nas duas apps (Exames-School e Exames-Classifica-es).
 * Se o alterares numa, copia-o para a outra.
 *
 * Funcionamento:
 *  1. Ao arrancar carrega todas as coleções da base de dados para o estado React.
 *  2. Sempre que o estado muda, calcula a diferença face ao último estado
 *     sincronizado e envia só os registos novos/alterados/removidos.
 *  3. Subscreve o Supabase Realtime: alterações feitas pela outra app (ou por
 *     outro utilizador, ou pelos gatilhos da base de dados) entram no estado.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, any>;

export interface Binding {
  /** Nome da coleção no estado da app (ex.: 'students'). */
  key: string;
  /** Tabela no Supabase. */
  table: string;
  /** Filtros de igualdade aplicados na leitura/remoção (ex.: { app: 'exames', colecao: 'rooms' }). */
  match?: Record<string, string>;
  /** Coluna(s) de conflito para upsert (por omissão 'id'). */
  onConflict?: string;
  /** Converte um item local numa linha da tabela. */
  toRow: (item: any) => Row;
  /** Converte uma linha num item local; devolve null se não se aplicar a esta app. */
  fromRow: (row: Row) => any | null;
  /** Ordenação/limite na carga inicial (ex.: auditoria mais recente). */
  order?: { column: string; ascending: boolean };
  limit?: number;
  /** Registos só de acrescentar (ex.: auditoria): insere sem nunca atualizar nem apagar. */
  insertOnly?: boolean;
  /** Dados da outra app: só leitura (nunca são enviados). */
  readOnly?: boolean;
}

export type SyncStatus = 'desligado' | 'a ligar' | 'sincronizado' | 'a enviar' | 'erro' | 'offline';


const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
};

const rowMatches = (row: Row, match?: Record<string, string>) =>
  !match || Object.entries(match).every(([k, v]) => row[k] === v);

export class SyncEngine<S extends Record<string, any>> {
  private snapshot = new Map<string, Map<string, string>>();
  private channel: RealtimeChannel | null = null;
  private ready = false;
  private pushTimer: number | null = null;
  private pushing = Promise.resolve();
  private latest: S | null = null;
  private retryTimer: number | null = null;

  constructor(
    readonly client: SupabaseClient,
    private readonly bindings: Binding[],
    private readonly applyRemote: (updater: (prev: S) => S) => void,
    private readonly onStatus: (status: SyncStatus, detail?: string) => void,
    /** Filtro do Realtime para a tabela "registos" (ex.: só a app atual). */
    private readonly registosFilter?: string
  ) {}

  private idOf(b: Binding, item: any): string {
    return String(item?.id ?? '');
  }

  private async loadBinding(b: Binding): Promise<any[]> {
    const pageSize = 1000;
    const max = b.limit ?? Number.MAX_SAFE_INTEGER;
    const out: Row[] = [];
    for (let from = 0; from < max; from += pageSize) {
      let q = this.client.from(b.table).select('*');
      for (const [k, v] of Object.entries(b.match ?? {})) q = q.eq(k, v);
      if (b.order) q = q.order(b.order.column, { ascending: b.order.ascending });
      q = q.range(from, Math.min(from + pageSize, max) - 1);
      const { data, error } = await q;
      if (error) throw new Error(`${b.table}/${b.key}: ${error.message}`);
      out.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return out.map((r) => b.fromRow(r)).filter((x) => x !== null);
  }

  /** Carrega tudo da base de dados e substitui as coleções locais. */
  async start(): Promise<void> {
    this.onStatus('a ligar');
    try {
      const loaded = await Promise.all(this.bindings.map((b) => this.loadBinding(b)));
      const patch: Record<string, any[]> = {};
      this.bindings.forEach((b, i) => {
        patch[b.key] = loaded[i];
        this.snapshot.set(
          b.key,
          new Map(loaded[i].map((item) => [this.idOf(b, item), stableStringify(item)]))
        );
      });
      this.applyRemote((prev) => ({ ...prev, ...patch }));
      this.ready = true;
      // O tempo real tem de usar o token atual (ex.: já com MFA/aal2), senão as regras de acesso
      // da base de dados não deixam passar os eventos.
      const { data: sessao } = await this.client.auth.getSession();
      if (sessao.session) await this.client.realtime.setAuth(sessao.session.access_token);
      this.subscribe();
      this.onStatus('sincronizado');
    } catch (err) {
      this.onStatus('offline', err instanceof Error ? err.message : String(err));
      this.retryTimer = window.setTimeout(() => void this.start(), 15000);
    }
  }

  stop() {
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    if (this.pushTimer) window.clearTimeout(this.pushTimer);
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
    this.ready = false;
  }

  private subscribe() {
    const tables = Array.from(new Set(this.bindings.map((b) => b.table)));
    let ch = this.client.channel(`sigen-sync-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of tables) {
      const filter = table === 'registos' ? this.registosFilter : undefined;
      ch = ch.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: any) => this.handleRemote(table, payload)
      );
    }
    ch.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.onStatus('erro', 'Ligação em tempo real interrompida.');
      if (status === 'SUBSCRIBED') this.onStatus('sincronizado');
    });
    this.channel = ch;
  }

  private handleRemote(table: string, payload: any) {
    const isDelete = payload.eventType === 'DELETE';
    const row: Row = isDelete ? payload.old : payload.new;
    if (!row) return;
    const binding = this.bindings.find((b) => b.table === table && rowMatches(row, b.match));
    if (!binding) return;
    const snap = this.snapshot.get(binding.key)!;

    if (isDelete) {
      // Com RLS, o Realtime só envia a chave primária nas remoções
      const id = String(row.id);
      if (!snap.has(id)) return;
      snap.delete(id);
      this.applyRemote((prev) => ({
        ...prev,
        [binding.key]: (prev[binding.key] as any[]).filter((x) => this.idOf(binding, x) !== id),
      }));
      return;
    }

    const item = binding.fromRow(row);
    if (!item) return;
    const id = this.idOf(binding, item);
    const json = stableStringify(item);
    if (snap.get(id) === json) return; // eco das nossas próprias escritas
    snap.set(id, json);
    this.applyRemote((prev) => {
      const list = (prev[binding.key] as any[]) ?? [];
      const idx = list.findIndex((x) => this.idOf(binding, x) === id);
      const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [item, ...list];
      return { ...prev, [binding.key]: next };
    });
  }

  /** Envia já as alterações pendentes (ex.: antes de terminar sessão). */
  async flush(state?: S) {
    if (state) this.latest = state;
    if (!this.ready) return;
    if (this.pushTimer) window.clearTimeout(this.pushTimer);
    this.pushing = this.pushing.then(() => this.push());
    await this.pushing;
  }

  /** Chamar sempre que o estado local muda. Envia as diferenças (com debounce). */
  notifyLocalChange(state: S) {
    this.latest = state;
    if (!this.ready) return;
    if (this.pushTimer) window.clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => {
      this.pushing = this.pushing.then(() => this.push());
    }, 350);
  }

  private async push() {
    const state = this.latest;
    if (!state) return;
    const errors: string[] = [];
    let sent = false;

    for (const b of this.bindings) {
      if (b.readOnly) continue;
      const snap = this.snapshot.get(b.key)!;
      const items = (state[b.key] as any[]) ?? [];
      const current = new Map<string, { item: any; json: string }>();
      for (const item of items) current.set(this.idOf(b, item), { item, json: stableStringify(item) });

      const changed = [...current.entries()].filter(([id, v]) =>
        b.insertOnly ? !snap.has(id) : snap.get(id) !== v.json
      );
      const removed = b.insertOnly ? [] : [...snap.keys()].filter((id) => !current.has(id));
      if (changed.length === 0 && removed.length === 0) continue;
      if (!sent) this.onStatus('a enviar');
      sent = true;

      if (changed.length) {
        changed.forEach(([id, v]) => snap.set(id, v.json));
        const rows = changed.map(([, v]) => b.toRow(v.item));
        const { error } = await this.client
          .from(b.table)
          .upsert(rows, { onConflict: b.onConflict ?? 'id', ignoreDuplicates: !!b.insertOnly });
        if (error) {
          changed.forEach(([id]) => snap.delete(id)); // volta a tentar na próxima alteração
          errors.push(`${b.key}: ${error.message}`);
        }
      }
      if (removed.length) {
        let q = this.client.from(b.table).delete().in('id', removed);
        for (const [k, v] of Object.entries(b.match ?? {})) q = q.eq(k, v);
        const { error } = await q;
        if (error) errors.push(`${b.key}: ${error.message}`);
        else removed.forEach((id) => snap.delete(id));
      }
    }

    if (errors.length) {
      console.error('[SIGEN sync]', errors);
      this.onStatus('erro', errors.join(' · '));
    } else if (sent) {
      this.onStatus('sincronizado');
    }
  }
}

/** Binding genérico para coleções guardadas na tabela documental "registos". */
export const registosBinding = (
  app: 'exames' | 'classificacoes',
  key: string,
  institutionField?: string
): Binding => ({
  key,
  table: 'registos',
  match: { app, colecao: key },
  onConflict: 'app,colecao,id',
  toRow: (item) => ({
    app,
    colecao: key,
    id: item.id,
    instituicao_id: institutionField ? item[institutionField] ?? null : null,
    dados: item,
  }),
  fromRow: (row) => row.dados,
});

// ---------------------------------------------------------------------
// Utilitários de conversão partilhados pelos adaptadores
// ---------------------------------------------------------------------
/** 'YYYY-MM-DD HH:mm' (hora local) -> ISO */
export const localToIso = (v?: string | null): string | null => {
  if (!v) return null;
  const local = v.length === 10 ? `${v}T12:00` : v.includes('T') ? v : v.replace(' ', 'T');
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
/** ISO -> 'YYYY-MM-DD HH:mm' (hora local) */
export const isoToLocal = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.getSeconds() ? `${base}:${p(d.getSeconds())}` : base;
};
/** ISO normalizado (com milissegundos, UTC) */
export const normIso = (v?: string | null): string => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
};
/** Date-only seguro (aceita '' -> null) */
export const dateOrNull = (v?: string | null) => (v ? v.slice(0, 10) : null);
