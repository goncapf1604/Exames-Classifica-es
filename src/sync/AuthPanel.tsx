/**
 * SIGEN · Ecrã de autenticação real (C01) com Supabase Auth. Idêntico nas duas apps.
 * Credenciais -> MFA (verificar ou configurar) -> troca da palavra-passe temporária.
 */
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import {
  entrar,
  iniciarConfiguracaoMfa,
  PassoLogin,
  proximoPasso,
  sair,
  SessaoSigen,
  SigenApp,
  trocarPassword,
  validarNovaPassword,
  verificarMfa,
} from './auth';

interface Props {
  app: SigenApp;
  /** Perfis (canónicos) com acesso a esta app. */
  perfis: string[];
  logo: React.ReactNode;
  subtitulo: string;
  onAutenticado: (sessao: SessaoSigen) => void | Promise<void>;
}

const input =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#112A4A] focus:border-[#087E91] focus:outline-none focus:ring-2 focus:ring-[#087E91]/20';
const botao =
  'w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#112A4A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B1E36] disabled:opacity-60';

export const AuthPanel: React.FC<Props> = ({ app, perfis, logo, subtitulo, onAutenticado }) => {
  const [passo, setPasso] = useState<PassoLogin | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ factorId: string; qr: string; segredo: string } | null>(null);
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ajuda, setAjuda] = useState(false);

  const avancar = async () => {
    try {
      const p = await proximoPasso(perfis);
      setPasso(p);
      setCodigo('');
      if (p.passo === 'concluido') await onAutenticado(p.sessao);
      if (p.passo === 'configurar_mfa') setMfaSetup(await iniciarConfiguracaoMfa());
    } catch (e) {
      setErro('Não foi possível contactar o servidor SIGEN. Verifique a ligação e tente novamente.');
      setPasso({ passo: 'credenciais' });
      console.error(e);
    }
  };

  useEffect(() => {
    void avancar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executar = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setACarregar(true);
    try {
      await fn();
    } finally {
      setACarregar(false);
    }
  };

  const onCredenciais = executar(async () => {
    if (tentativas >= 5) {
      setErro('Demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.');
      return;
    }
    const ok = await entrar(email, password, app);
    setPassword('');
    if (!ok) {
      setTentativas((t) => t + 1);
      setErro('Credenciais inválidas ou acesso não autorizado.');
      return;
    }
    setTentativas(0);
    await avancar();
  });

  const onMfa = executar(async () => {
    const factorId = passo?.passo === 'mfa' ? passo.factorId : mfaSetup?.factorId;
    if (!factorId) return;
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErro('Introduza os 6 dígitos da aplicação autenticadora.');
      return;
    }
    if (!(await verificarMfa(factorId, codigo))) {
      setErro('Código inválido ou expirado.');
      setCodigo('');
      return;
    }
    setMfaSetup(null);
    await avancar();
  });

  const onTrocar = executar(async () => {
    const invalida = validarNovaPassword(nova);
    if (invalida) return setErro(invalida);
    if (nova !== confirmacao) return setErro('As palavras-passe não coincidem.');
    const falha = await trocarPassword(nova);
    if (falha) return setErro('Não foi possível alterar a palavra-passe. Escolha outra e tente novamente.');
    setNova('');
    setConfirmacao('');
    await avancar();
  });

  const cancelar = async () => {
    await sair();
    setMfaSetup(null);
    setErro('');
    setPasso({ passo: 'credenciais' });
  };

  const titulo: Record<PassoLogin['passo'], string> = {
    credenciais: 'Iniciar sessão',
    mfa: 'Verificação em dois passos',
    configurar_mfa: 'Configurar verificação em dois passos',
    trocar_password: 'Definir nova palavra-passe',
    bloqueado: 'Acesso indisponível',
    concluido: 'A carregar dados…',
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col justify-center py-10 px-4">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="lg:col-span-5 bg-[#112A4A] text-white p-8 flex flex-col justify-between gap-8">
          <div>{logo}</div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />
              <span>C01 · Acesso e autenticação</span>
            </div>
            <p>{subtitulo}</p>
            <p>
              Acesso pessoal e intransmissível. As ações são registadas em auditoria. A mesma conta serve o SIGEN
              Exames e o SIGEN Classificações, conforme o perfil atribuído.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 p-8">
          <h1 className="text-xl font-bold text-[#112A4A] mb-1">{passo ? titulo[passo.passo] : 'A verificar sessão…'}</h1>
          {erro && (
            <div role="alert" className="mt-3 mb-1 rounded-md border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">
              {erro}
            </div>
          )}

          {(!passo || passo.passo === 'concluido') && (
            <div className="mt-6 flex items-center gap-2 text-sm text-[#536477]">
              <Loader2 className="w-4 h-4 animate-spin" /> Aguarde…
            </div>
          )}

          {passo?.passo === 'credenciais' && (
            <form onSubmit={onCredenciais} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-[#112A4A]">
                Email profissional
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${input} mt-1`}
                  placeholder="nome@escola.edu.pt"
                />
              </label>
              <label className="block text-xs font-semibold text-[#112A4A]">
                Palavra-passe
                <div className="relative mt-1">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${input} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#536477]"
                    aria-label={verPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
              <button type="submit" disabled={aCarregar} className={botao}>
                {aCarregar ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Entrar
              </button>
              <button type="button" onClick={() => setAjuda((v) => !v)} className="text-xs font-medium text-[#087E91] hover:underline">
                Esqueceu a palavra-passe?
              </button>
              {ajuda && (
                <p className="text-xs text-[#536477] bg-slate-50 border border-slate-200 rounded-md p-3">
                  Peça ao administrador do seu agrupamento (ecrã C04) uma palavra-passe temporária. No próximo acesso
                  ser-lhe-á pedido que defina uma nova.
                </p>
              )}
            </form>
          )}

          {(passo?.passo === 'mfa' || (passo?.passo === 'configurar_mfa' && mfaSetup)) && (
            <form onSubmit={onMfa} className="mt-5 space-y-4">
              {passo.passo === 'configurar_mfa' && mfaSetup && (
                <div className="space-y-3">
                  <p className="text-xs text-[#536477]">
                    O seu perfil exige verificação em dois passos. Leia o código QR com uma aplicação autenticadora
                    (Google Authenticator, Microsoft Authenticator, Authy…) e introduza o código de 6 dígitos.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img src={mfaSetup.qr} alt="Código QR para configurar o MFA" className="w-40 h-40 border border-slate-200 rounded-md bg-white" />
                    <div className="text-xs text-[#536477] break-all">
                      Ou introduza manualmente:
                      <div className="mt-1 font-mono text-[13px] text-[#112A4A] select-all" data-testid="mfa-segredo">
                        {mfaSetup.segredo}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {passo.passo === 'mfa' && (
                <p className="text-xs text-[#536477] flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> Introduza o código de 6 dígitos da sua aplicação autenticadora.
                </p>
              )}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className={`${input} font-mono tracking-[0.4em] text-center text-lg`}
                aria-label="Código MFA"
              />
              <button type="submit" disabled={aCarregar} className={botao}>
                {aCarregar && <Loader2 className="w-4 h-4 animate-spin" />} Verificar
              </button>
              <button type="button" onClick={cancelar} className="text-xs font-medium text-[#536477] hover:underline">
                Cancelar e voltar
              </button>
            </form>
          )}

          {passo?.passo === 'trocar_password' && (
            <form onSubmit={onTrocar} className="mt-5 space-y-4">
              <p className="text-xs text-[#536477]">
                Está a usar uma palavra-passe temporária. Defina uma palavra-passe pessoal (mínimo 10 caracteres, com
                letras e números).
              </p>
              <label className="block text-xs font-semibold text-[#112A4A]">
                Nova palavra-passe
                <input type="password" autoComplete="new-password" required value={nova} onChange={(e) => setNova(e.target.value)} className={`${input} mt-1`} />
              </label>
              <label className="block text-xs font-semibold text-[#112A4A]">
                Confirmar palavra-passe
                <input type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={`${input} mt-1`} />
              </label>
              <button type="submit" disabled={aCarregar} className={botao}>
                {aCarregar && <Loader2 className="w-4 h-4 animate-spin" />} Guardar e continuar
              </button>
              <button type="button" onClick={cancelar} className="text-xs font-medium text-[#536477] hover:underline">
                Cancelar e voltar
              </button>
            </form>
          )}

          {passo?.passo === 'bloqueado' && (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-[#536477]">{passo.motivo}</p>
              <button type="button" onClick={cancelar} className={botao}>
                Voltar ao início de sessão
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
