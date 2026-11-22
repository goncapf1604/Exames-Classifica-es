/**
 * Gera o SQL com os dados de exemplo desta app para a base de dados partilhada.
 *   npx tsx scripts/gerar-seed-sql.ts > supabase/seed_classificacoes.sql
 * Usa "on conflict do nothing": nunca substitui dados que já existam.
 * Ordem recomendada: primeiro SIGEN Exames, depois SIGEN Classificações.
 */
import { INITIAL_SIGEN_STATE } from '../src/data/seedData';
import { CLASSIFICACOES_BINDINGS as BINDINGS } from '../src/sync/bindings';

const state: Record<string, any> = INITIAL_SIGEN_STATE;
const out: string[] = ['-- Gerado por scripts/gerar-seed-sql.ts (SIGEN Classificações)', 'begin;'];
for (const b of BINDINGS.filter((x) => !x.readOnly)) {
  const rows = ((state[b.key] as any[]) ?? []).map((i) => b.toRow(i));
  if (!rows.length) continue;
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const list = cols.join(', ');
  out.push(
    `insert into ${b.table} (${list})\n  select ${list} from jsonb_populate_recordset(null::${b.table}, $sigen$${JSON.stringify(rows)}$sigen$::jsonb)\n  on conflict do nothing;`
  );
}
out.push('commit;');
console.log(out.join('\n\n'));
