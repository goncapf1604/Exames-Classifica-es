// SIGEN · Gestão de contas de acesso (Supabase Auth) — usado pelo ecrã C04 das duas apps.
//
// Ações (POST JSON { acao, ... }) — só para Admin central / Admin de agrupamento com sessão completa:
//   criar          { email }           -> cria a conta com palavra-passe temporária (troca obrigatória)
//   repor_password { utilizador_id }   -> nova palavra-passe temporária (troca obrigatória)
//   repor_mfa      { utilizador_id }   -> remove os fatores MFA (o utilizador volta a configurar)
// A palavra-passe temporária é devolvida uma única vez ao administrador.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const passwordTemporaria = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const base = Array.from(bytes, (b) => abc[b % abc.length]).join('');
  return `${base.slice(0, 7)}-${base.slice(7)}!`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { erro: 'Método não suportado.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quem chama? (avaliado pela base de dados com o JWT do próprio: conta ativa, MFA, vigência)
  const { data: sessao, error: errSessao } = await caller.rpc('sigen_minha_sessao');
  if (errSessao || !sessao?.ativo || !['ADMIN_CENTRAL', 'ADMIN_AGRUPAMENTO'].includes(sessao.perfil)) {
    return json(403, { erro: 'Sem permissão para gerir contas.' });
  }
  const escolasPermitidas: string[] = sessao.escolas ?? [];

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json(400, { erro: 'Pedido inválido.' });
  }

  // Utilizador alvo (espera até 5 s: o registo pode ainda estar a ser gravado pela app)
  const carregarAlvo = async (filtro: { id?: string; email?: string }) => {
    for (let i = 0; i < 10; i++) {
      let q = service.from('utilizadores').select('id, email, perfil, escola_ids, auth_user_id');
      q = filtro.id ? q.eq('id', filtro.id) : q.ilike('email', filtro.email ?? '');
      const { data } = await q.maybeSingle();
      if (data) return data;
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  };
  const alvo = await carregarAlvo(body.utilizador_id ? { id: body.utilizador_id } : { email: body.email });
  if (!alvo) return json(404, { erro: 'Utilizador não encontrado no SIGEN.' });
  const dentroDoAmbito =
    sessao.perfil === 'ADMIN_CENTRAL' ||
    ((alvo.escola_ids as string[]).every((e) => escolasPermitidas.includes(e)) && alvo.perfil !== 'ADMIN_CENTRAL');
  if (!dentroDoAmbito) return json(403, { erro: 'Utilizador fora das escolas que administra.' });

  const auditar = (acao: string, detalhe: string) =>
    service.from('auditoria').insert({
      id: `aud-contas-${crypto.randomUUID()}`,
      instituicao_id: (alvo.escola_ids as string[])[0] ?? null,
      utilizador_email: sessao.email,
      utilizador_nome: sessao.nome,
      perfil: sessao.perfil,
      entidade: 'Conta de acesso (C04)',
      entidade_id: alvo.id,
      ecra: 'C04',
      acao,
      detalhe,
      sensivel: true,
      app_origem: body.app === 'classificacoes' ? 'classificacoes' : 'exames',
    });

  if (body.acao === 'criar') {
    if (alvo.auth_user_id) return json(409, { erro: 'Este utilizador já tem conta de acesso.' });
    const password = passwordTemporaria();
    const { error } = await service.auth.admin.createUser({
      email: alvo.email,
      password,
      email_confirm: true,
      app_metadata: { trocar_password: true },
    });
    if (error) return json(400, { erro: error.message });
    await auditar('CRIAR_CONTA', `Conta de acesso criada para ${alvo.email} (palavra-passe temporária).`);
    return json(200, { password });
  }

  if (!alvo.auth_user_id) return json(409, { erro: 'Este utilizador ainda não tem conta de acesso.' });

  if (body.acao === 'repor_password') {
    const password = passwordTemporaria();
    // Primeiro a password, depois a marca de troca obrigatória (ver gatilho limpar_trocar_password)
    const r1 = await service.auth.admin.updateUserById(alvo.auth_user_id, { password });
    if (r1.error) return json(400, { erro: r1.error.message });
    const r2 = await service.auth.admin.updateUserById(alvo.auth_user_id, { app_metadata: { trocar_password: true } });
    if (r2.error) return json(400, { erro: r2.error.message });
    await auditar('REPOR_PASSWORD', `Palavra-passe temporária emitida para ${alvo.email}.`);
    return json(200, { password });
  }

  if (body.acao === 'repor_mfa') {
    const { data, error } = await service.auth.admin.mfa.listFactors({ userId: alvo.auth_user_id });
    if (error) return json(400, { erro: error.message });
    for (const f of data?.factors ?? []) {
      await service.auth.admin.mfa.deleteFactor({ userId: alvo.auth_user_id, id: f.id });
    }
    await auditar('REPOR_MFA', `Fatores MFA removidos para ${alvo.email}; nova configuração obrigatória.`);
    return json(200, { ok: true });
  }

  return json(400, { erro: 'Ação desconhecida.' });
});
