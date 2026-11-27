import React, { useMemo, useState } from 'react';
import { correioAtivo, eEmailEscola, pedirCodigoAcesso, validarCodigoAcesso } from '../utils/correioInterno';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useSigen } from '../context/SigenContext';
import { ROLE_LABELS } from '../types/sigen';
import { SigenClassificacoesIcon, SigenLogo } from '../components/SigenLogo';
import { Button, FormField, Modal, NoticeBar, inputClass } from '../components/ui/SharedUI';

export const LoginScreen: React.FC = () => {
  const { state, login, toast } = useSigen();

  const [email, setEmail] = useState('admin@sigen-exemplo.pt');
  const [password, setPassword] = useState('Sigen2026!');
  const [mfaCode, setMfaCode] = useState('482910');
  const [institutionId, setInstitutionId] = useState('inst-esc-1');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const matchedUserPreview = useMemo(
    () => state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()),
    [state.users, email]
  );

  const userInstitutions = useMemo(() => {
    if (!matchedUserPreview) return state.institutions;
    return state.institutions.filter((i) => matchedUserPreview.escolasIds.includes(i.id));
  }, [matchedUserPreview, state.institutions]);

  const isLockedOut = attempts >= 5;
  // Código de acesso enviado para o Correio Interno (contas @esfp.pt com VITE_CORREIO_URL definido).
  const viaCorreio = correioAtivo() && eEmailEscola(email);
  const [codigoEnviadoPara, setCodigoEnviadoPara] = useState<string | null>(null);
  const [codigoInfo, setCodigoInfo] = useState('');
  const [aProcessar, setAProcessar] = useState(false);

  const enviarCodigo = async () => {
    setAProcessar(true);
    try {
      const out = await pedirCodigoAcesso(email);
      setCodigoEnviadoPara(email.trim().toLowerCase());
      setMfaCode('');
      setCodigoInfo(`${out.message} Válido até ${new Date(out.expiresAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o código.');
    } finally {
      setAProcessar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      setError('Limite de tentativas excedido. Aguarde antes de tentar novamente.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Preencha o email profissional e a palavra-passe.');
      return;
    }

    if (viaCorreio) {
      const check = login(email, password, '', institutionId, { apenasVerificar: true });
      if (!check.ok) {
        setAttempts((a) => a + 1);
        setError(check.error || 'Falha na autenticação.');
        return;
      }
      if (codigoEnviadoPara !== email.trim().toLowerCase() || mfaCode.length !== 6) {
        if (codigoEnviadoPara !== email.trim().toLowerCase()) await enviarCodigo();
        else setError('Introduza o código de 6 dígitos recebido no Correio Interno.');
        return;
      }
      setAProcessar(true);
      try {
        await validarCodigoAcesso(email, mfaCode);
      } catch (err: any) {
        setAttempts((a) => a + 1);
        setError(err?.message || 'Código inválido ou expirado.');
        setAProcessar(false);
        return;
      }
      setAProcessar(false);
      const res2 = login(email, password, '', institutionId, { codigoValidado: true });
      if (!res2.ok) setError(res2.error || 'Falha na autenticação.');
      else {
        setError(null);
        setAttempts(0);
      }
      return;
    }

    const res = login(email, password, mfaCode, institutionId);
    if (!res.ok) {
      setAttempts((a) => a + 1);
      setError(res.error || 'Falha na autenticação.');
    } else {
      setError(null);
      setAttempts(0);
    }
  };

  const quickFill = (userId: string) => {
    const u = state.users.find((x) => x.id === userId);
    if (!u) return;
    setEmail(u.email);
    setPassword(u.passwordDemo);
    setMfaCode(u.mfaAtivo ? u.mfaCodigoDemo : '');
    setInstitutionId(u.escolasIds[0] || 'inst-esc-1');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Institutional Column (Navy #112A4A) */}
        <div className="lg:col-span-5 bg-[#112A4A] text-white p-8 lg:p-12 flex flex-col justify-between">
          <div>
            <SigenLogo variant="dark" subBrand="Gestão de Exames" />
            <div className="mt-10 space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-medium text-[#5EEAD4]">
                <SigenClassificacoesIcon size={20} />
                <span>C01 · Acesso e autenticação institucional</span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight leading-tight text-balance">
                Gestão integrada de classificações com controlo de custódia e auditoria.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                Plataforma modular desenhada para agrupamentos e escolas, com isolamento rigoroso
                por instituição, autorização por perfil e rastreabilidade completa de todas as
                operações críticas.
              </p>
            </div>

            <div className="mt-10 pt-8 border-t border-white/15 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#22B8CF] mt-0.5 shrink-0" />
                <span>Isolamento multi-tenant por instituição e segregação de funções incompatíveis.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#22B8CF] mt-0.5 shrink-0" />
                <span>Autenticação multifator (MFA), limitação de tentativas e registo de auditoria imutável.</span>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
            Aviso: Ambiente de demonstração com dados exclusivamente fictícios. Proposta de produto
            SIGEN v2.0 — gestão de classificações de exames nacionais.
          </div>
        </div>

        {/* Right Login Form + Demo Profile Selector */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-14 flex items-center justify-center">
          <div className="w-full max-w-xl space-y-8">
            <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
              <div className="mb-6">
                <div className="text-xs font-mono font-semibold text-[#087E91]">C01 · Autenticação</div>
                <h2 className="font-display text-2xl font-bold text-[#112A4A] mt-1">
                  Entrar em SIGEN Classificações
                </h2>
                <p className="text-sm text-[#536477] mt-1">
                  Introduza as suas credenciais profissionais e selecione a instituição autorizada.
                </p>
              </div>

              {error && (
                <div className="mb-5">
                  <NoticeBar tone="danger" title="Acesso não concluído">
                    {error} {attempts > 0 && `(Tentativa ${attempts}/5)`}
                  </NoticeBar>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Email profissional" required>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@escola.edu.pt"
                    className={inputClass}
                    autoComplete="username"
                  />
                </FormField>

                <FormField label="Palavra-passe" required>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#536477] hover:text-[#112A4A] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label={viaCorreio ? 'Código enviado para o email (6 dígitos)' : 'Código MFA (6 dígitos)'}
                    conditional
                    hint={
                      viaCorreio
                        ? codigoEnviadoPara
                          ? codigoInfo || 'Consulte o Correio Interno.'
                          : 'Carregue em "Entrar" para receber o código no Correio Interno (noreply@esfp.pt).'
                        : matchedUserPreview?.mfaAtivo
                        ? `MFA ativo nesta conta (demo: ${matchedUserPreview.mfaCodigoDemo})`
                        : 'Obrigatório quando MFA está ativado'
                    }
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className={`${inputClass} font-mono tabular-nums tracking-widest`}
                    />
                  </FormField>

                  <FormField label="Instituição" conditional hint="Quando existem múltiplos acessos">
                    <select
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      className={inputClass}
                    >
                      {userInstitutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.designacao}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email);
                      setRecoveryOpen(true);
                    }}
                    className="text-xs font-medium text-[#087E91] hover:underline cursor-pointer"
                  >
                    Recuperar acesso
                  </button>
                  {viaCorreio && codigoEnviadoPara && (
                    <Button type="button" variant="secondary" disabled={aProcessar} onClick={() => void enviarCodigo()}>
                      Reenviar código
                    </Button>
                  )}
                  <Button type="submit" variant="primary" disabled={isLockedOut || aProcessar}>
                    <KeyRound className="w-4 h-4" />
                    {viaCorreio && !codigoEnviadoPara ? 'Enviar código e continuar' : 'Entrar na plataforma'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Quick demo profiles selector so evaluator can test RBAC across all 30 screens */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#112A4A]">
                    Perfis de demonstração (Dados de exemplo)
                  </h3>
                  <p className="text-xs text-[#536477]">
                    Selecione um perfil para preencher automaticamente e validar permissões por ecrã.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {state.users.map((u) => {
                  const selected = u.email.toLowerCase() === email.toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => quickFill(u.id)}
                      className={`text-left px-3 py-2.5 rounded-md border text-xs transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#087E91] bg-[#F0F9FA] text-[#112A4A]'
                          : 'border-slate-200 hover:bg-slate-50 text-[#112A4A]'
                      }`}
                    >
                      <div className="font-semibold truncate">{ROLE_LABELS[u.perfil]}</div>
                      <div className="text-[11px] text-[#536477] truncate mt-0.5">
                        {u.nome} · {u.mfaAtivo ? `MFA ${u.mfaCodigoDemo}` : 'Sem MFA'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      <Modal
        open={recoveryOpen}
        title="Recuperar acesso"
        subtitle="Pedido de reposição de palavra-passe institucional"
        onClose={() => setRecoveryOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setRecoveryOpen(false);
            toast({
              type: 'info',
              title: 'Pedido de recuperação registado',
              detail:
                'Se o endereço profissional existir e estiver ativo, receberá instruções seguras (sem revelação de existência da conta).',
            });
          }}
          className="space-y-4"
        >
          <FormField label="Email profissional" required>
            <input
              type="email"
              required
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <p className="text-xs text-[#536477]">
            Por motivos de segurança (C01), o sistema não confirma se o endereço existe no diretório.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRecoveryOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Iniciar reposição
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
