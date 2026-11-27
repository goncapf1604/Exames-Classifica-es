/**
 * SIGEN · Autenticação real (Supabase Auth). Ficheiro idêntico nas duas apps.
 *
 * Passos de um login completo:
 *   1. email + palavra-passe
 *   2. MFA TOTP (aplicação autenticadora) se a conta tiver MFA ativo — configuração no 1.º acesso
 *   3. troca obrigatória da palavra-passe temporária
 * A base de dados só devolve dados quando os três passos estão cumpridos.
 */
import { sigenDb } from './client';

export type SigenApp = 'exames' | 'classificacoes';

export interface SessaoSigen {
  utilizador_id: string;
  nome: string;
  email: string;
  perfil: string;
  estado: 'Ativo' | 'Convidado' | 'Suspenso';
  mfa_ativo: boolean;
  dentro_vigencia: boolean;
  trocar_password: boolean;
  aal: string | null;
  ativo: boolean;
  escolas: string[];
}

export type PassoLogin =
  | { passo: 'credenciais' }
  | { passo: 'mfa'; factorId: string }
  | { passo: 'configurar_mfa' }
  | { passo: 'trocar_password' }
  | { passo: 'bloqueado'; motivo: string }
  | { passo: 'concluido'; sessao: SessaoSigen };

const db = () => {
  if (!sigenDb) throw new Error('Base de dados SIGEN não configurada.');
  return sigenDb;
};

export async function obterSessao(): Promise<SessaoSigen | null> {
  const { data, error } = await db().rpc('sigen_minha_sessao');
  if (error) throw error;
  return (data as SessaoSigen) ?? null;
}

/** Decide o próximo passo a partir da sessão atual (também usado ao recarregar a página). */
export async function proximoPasso(perfisDaApp: string[]): Promise<PassoLogin> {
  const { data: s } = await db().auth.getSession();
  if (!s.session) return { passo: 'credenciais' };
  const sessao = await obterSessao();
  if (!sessao) return { passo: 'bloqueado', motivo: 'Esta conta não está associada a nenhum utilizador SIGEN.' };
  if (sessao.estado !== 'Ativo') return { passo: 'bloqueado', motivo: `Conta ${sessao.estado.toLowerCase()}. Contacte o administrador.` };
  if (!sessao.dentro_vigencia) return { passo: 'bloqueado', motivo: 'O período de vigência deste acesso terminou ou ainda não começou.' };
  if (!perfisDaApp.includes(sessao.perfil)) {
    return { passo: 'bloqueado', motivo: 'O seu perfil não tem acesso a esta aplicação SIGEN.' };
  }
  if (sessao.mfa_ativo && sessao.aal !== 'aal2') {
    const { data } = await db().auth.mfa.listFactors();
    const totp = data?.totp?.find((f) => f.status === 'verified');
    return totp ? { passo: 'mfa', factorId: totp.id } : { passo: 'configurar_mfa' };
  }
  if (sessao.trocar_password) return { passo: 'trocar_password' };
  if (!sessao.ativo) return { passo: 'bloqueado', motivo: 'Acesso não autorizado.' };
  return { passo: 'concluido', sessao };
}

export async function entrar(email: string, password: string, app: SigenApp): Promise<boolean> {
  const { error } = await db().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    await db().rpc('sigen_registar_falha_login', { p_email: email.trim().toLowerCase(), p_app: app });
    return false;
  }
  return true;
}

export async function verificarMfa(factorId: string, codigo: string): Promise<boolean> {
  const { error } = await db().auth.mfa.challengeAndVerify({ factorId, code: codigo.trim() });
  return !error;
}

/** Inicia a configuração do MFA: devolve o QR (SVG data URL) e o segredo para inserção manual. */
export async function iniciarConfiguracaoMfa(): Promise<{ factorId: string; qr: string; segredo: string }> {
  const { data: lista } = await db().auth.mfa.listFactors();
  for (const f of lista?.all ?? []) {
    if (f.status !== 'verified') await db().auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await db().auth.mfa.enroll({ factorType: 'totp', friendlyName: `SIGEN ${Date.now()}` });
  if (error || !data) throw error ?? new Error('Não foi possível iniciar o MFA.');
  return { factorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

export function validarNovaPassword(p: string): string | null {
  if (p.length < 10) return 'A palavra-passe deve ter pelo menos 10 caracteres.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Use letras e números.';
  if (/sigen2026/i.test(p)) return 'Escolha uma palavra-passe diferente da inicial.';
  return null;
}

export async function trocarPassword(nova: string): Promise<string | null> {
  const { error } = await db().auth.updateUser({ password: nova });
  if (error) return error.message;
  await db().auth.refreshSession();
  return null;
}

export async function sair() {
  await db().auth.signOut();
}

/** Gestão de contas (C04) — função de servidor "sigen-contas". */
export async function gerirConta(
  acao: 'criar' | 'repor_password' | 'repor_mfa',
  dados: { email?: string; utilizador_id?: string },
  app: SigenApp
): Promise<{ password?: string; erro?: string }> {
  const { data, error } = await db().functions.invoke('sigen-contas', { body: { acao, app, ...dados } });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).erro ?? msg;
    } catch {
      /* mantém a mensagem genérica */
    }
    return { erro: msg };
  }
  return data ?? {};
}
