/**
 * Ligação ao Correio Interno ESFP (noreply@esfp.pt).
 *
 * - Código de acesso: em vez do código de demonstração, o funcionário recebe um código de
 *   6 dígitos no seu email institucional @esfp.pt (válido 10 min, uso único).
 * - Notificações (convocatórias de vigilância, avisos, comunicações C06): entregues na caixa
 *   de email institucional dos destinatários @esfp.pt.
 *
 * Ativa-se definindo VITE_CORREIO_URL (ex.: https://correio.esfp.pt) no build. Sem ela,
 * a app mantém o comportamento de demonstração.
 */
const APP_ID = 'sigen-classificacoes';
const TOKEN_KEY = `esfp_correio_token_${APP_ID}`;

function baseUrl(): string {
  const raw = String((import.meta as any).env?.VITE_CORREIO_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

export function correioAtivo(): boolean {
  return Boolean(baseUrl());
}

/** Só os endereços @esfp.pt (docentes, funcionários, direção) recebem códigos e convocatórias. */
export function eEmailEscola(email?: string | null): boolean {
  return /^[^@\s]+@esfp\.pt$/i.test(String(email || '').trim());
}

async function post<T = any>(path: string, body: unknown, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/integration${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem ligação ao Correio Interno. Verifique a ligação à internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro do Correio Interno (${res.status}).`);
  return data as T;
}

/** Envia para o email institucional um código de acesso (a resposta é igual exista ou não a conta). */
export async function pedirCodigoAcesso(email: string): Promise<{ expiresAt: string; message: string }> {
  return post('/otp/request', { email: email.trim().toLowerCase(), app: APP_ID, purpose: 'login' });
}

export async function validarCodigoAcesso(email: string, code: string): Promise<{ name: string; email: string; role: string }> {
  const out = await post<{ token: string; user: { name: string; email: string; role: string } }>('/otp/verify', {
    email: email.trim().toLowerCase(),
    app: APP_ID,
    code: code.replace(/\D/g, ''),
  });
  try {
    sessionStorage.setItem(TOKEN_KEY, out.token);
  } catch { /* modo privado */ }
  return out.user;
}

export function terminarSessaoCorreio(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* nada */ }
}

function tokenAtual(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function podeEnviarEmails(): boolean {
  return correioAtivo() && Boolean(tokenAtual());
}

export interface ResultadoEnvio {
  entregues: string[];
  naoEncontrados: string[];
  recusados: string[];
}

/** Envia uma notificação para endereços @esfp.pt (a sessão tem de ter entrado com código do correio). */
export async function enviarEmailInstitucional(n: { para: string[]; assunto: string; mensagem: string; area?: string; ref?: string }): Promise<ResultadoEnvio> {
  if (!correioAtivo()) throw new Error('Correio Interno não configurado (VITE_CORREIO_URL).');
  const token = tokenAtual();
  if (!token) throw new Error('Para enviar emails, entre na aplicação com o código enviado para o Correio Interno.');
  const out = await post<any>('/notify', {
    to: n.para.map((email) => ({ email: email.trim().toLowerCase() })),
    subject: n.assunto,
    body: n.mensagem,
    areaLabel: n.area,
    ref: n.ref,
  }, token);
  return { entregues: out.delivered || [], naoEncontrados: out.notFound || [], recusados: out.rejected || [] };
}
