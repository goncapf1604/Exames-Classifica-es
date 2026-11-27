/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SigenProvider, useSigen } from './context/SigenContext';
import { Layout } from './components/Layout';
import { LoginScreen } from './screens/LoginScreen';
import { EN01FormatosScreen, EN02ImportacaoScreen, EN03ReconciliacaoScreen } from './screens/EnesScreens';
import { AuthPanel } from './sync/AuthPanel';
import { CLASSIFICACOES_PERFIS } from './sync/bindings';
import { SigenLogo } from './components/SigenLogo';
import {
  C02DashboardScreen,
  C03InstitutionsScreen,
  C04UsersScreen,
  C05CalendarScreen,
  C06NotificationsScreen,
  C07AuditScreen,
} from './screens/AdminScreens';
import {
  K01ClassificationsDashboardScreen,
  K02CustodyScreen,
  K03AnonymousIdScreen,
  K04GradersScreen,
  K05DistributionScreen,
} from './screens/ReceptionScreens';
import {
  K06ViewerScreen,
  K07ItemGradingScreen,
  K08VerificationScreen,
  K09CriteriaScreen,
} from './screens/CorrectionScreens';
import {
  K10ImportScreen,
  K11ResultsScreen,
  K12PautasScreen,
  K13PublicationScreen,
} from './screens/ResultsScreens';
import {
  K14ConsultationsScreen,
  K15AvailabilityScreen,
  K16ScoreRectificationScreen,
  K17ReappraisalRequestScreen,
  K18ReappraisalTrackingScreen,
  K19JneComplaintScreen,
  K20RectificationsBookScreen,
} from './screens/AppealsScreens';
import {
  K21InteropScreen,
  K22ReportsScreen,
  K23ClosureScreen,
} from './screens/IntegrationScreens';

import { X } from 'lucide-react';

const GlobalToasts: React.FC = () => {
  const { toasts, dismissToast } = useSigen();
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-white border border-slate-200 shadow-lg rounded-lg p-3.5 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <div
              className={`text-xs font-bold ${
                t.type === 'error'
                  ? 'text-[#B91C1C]'
                  : t.type === 'warning'
                    ? 'text-[#9A6B00]'
                    : t.type === 'success'
                      ? 'text-[#286B42]'
                      : 'text-[#087E91]'
              }`}
            >
              {t.title}
            </div>
            {t.detail && <div className="text-xs text-[#536477] mt-0.5">{t.detail}</div>}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

/** C01 com sessão iniciada (modo servidor): dados da sessão e saída segura. */
const SessaoAtual: React.FC = () => {
  const { currentUser, logout } = useSigen();
  if (!currentUser) return null;
  return (
    <div className="max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-3">
      <h1 className="text-lg font-bold text-[#112A4A]">C01 · Sessão autenticada</h1>
      <p className="text-sm text-[#536477]">
        {currentUser.nome} · {currentUser.email}
      </p>
      <p className="text-xs text-[#536477]">
        Autenticação gerida pela base de dados SIGEN{currentUser.mfaAtivo ? ' com verificação em dois passos (MFA)' : ''}.
        Para alterar a palavra-passe ou o MFA peça ao administrador do agrupamento (C04).
      </p>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center rounded-md bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
      >
        Terminar sessão
      </button>
    </div>
  );
};

const SigenRouter: React.FC = () => {
  const { currentUser, activeScreen, modoServidor, iniciarSessao } = useSigen();

  if (!currentUser || (activeScreen === 'C01' && !modoServidor)) {
    return (
      <>
        {modoServidor && !currentUser ? (
          <AuthPanel
            app="classificacoes"
            perfis={CLASSIFICACOES_PERFIS}
            logo={<SigenLogo variant="dark" subBrand="Classificações" />}
            subtitulo="SIGEN Classificações · receção de provas, classificação, resultados e reapreciações."
            onAutenticado={iniciarSessao}
          />
        ) : (
          <LoginScreen />
        )}
        <GlobalToasts />
      </>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'C01':
        return <SessaoAtual />;
      case 'C02':
        return <C02DashboardScreen />;
      case 'C03':
        return <C03InstitutionsScreen />;
      case 'C04':
        return <C04UsersScreen />;
      case 'C05':
        return <C05CalendarScreen />;
      case 'C06':
        return <C06NotificationsScreen />;
      case 'C07':
        return <C07AuditScreen />;
      case 'K01':
        return <K01ClassificationsDashboardScreen />;
      case 'K02':
        return <K02CustodyScreen />;
      case 'K03':
        return <K03AnonymousIdScreen />;
      case 'K04':
        return <K04GradersScreen />;
      case 'K05':
        return <K05DistributionScreen />;
      case 'K06':
        return <K06ViewerScreen />;
      case 'K07':
        return <K07ItemGradingScreen />;
      case 'K08':
        return <K08VerificationScreen />;
      case 'K09':
        return <K09CriteriaScreen />;
      case 'K10':
        return <K10ImportScreen />;
      case 'K11':
        return <K11ResultsScreen />;
      case 'K12':
        return <K12PautasScreen />;
      case 'K13':
        return <K13PublicationScreen />;
      case 'K14':
        return <K14ConsultationsScreen />;
      case 'K15':
        return <K15AvailabilityScreen />;
      case 'K16':
        return <K16ScoreRectificationScreen />;
      case 'K17':
        return <K17ReappraisalRequestScreen />;
      case 'K18':
        return <K18ReappraisalTrackingScreen />;
      case 'K19':
        return <K19JneComplaintScreen />;
      case 'K20':
        return <K20RectificationsBookScreen />;
      case 'K21':
        return <K21InteropScreen />;
      case 'EN01':
        return <EN01FormatosScreen />;
      case 'EN02':
        return <EN02ImportacaoScreen />;
      case 'EN03':
        return <EN03ReconciliacaoScreen />;
      case 'K22':
        return <K22ReportsScreen />;
      case 'K23':
        return <K23ClosureScreen />;
      default:
        return <C02DashboardScreen />;
    }
  };

  return (
    <>
      <Layout>{renderScreen()}</Layout>
      <GlobalToasts />
    </>
  );
};

export default function App() {
  return (
    <SigenProvider>
      <SigenRouter />
    </SigenProvider>
  );
}
