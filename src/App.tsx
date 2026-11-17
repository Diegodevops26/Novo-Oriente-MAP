/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useEffect, useState} from 'react';
import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import {InteractiveMap} from './components/InteractiveMap';

declare const process: {env?: {GOOGLE_MAPS_API_KEY?: string}} | undefined;

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_API_KEY : '') ||
  '';

function MapsStatusGuard({children}: {children: React.ReactNode}) {
  const status = useApiLoadingStatus();

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">
            Falha ao carregar o Google Maps
          </h2>
          <p className="text-sm text-slate-600">
            Não foi possível autenticar ou carregar a API de mapas. Verifique a chave configurada ou a cota do projeto.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [requestedSection, setRequestedSection] = useState<
    'all' | 'tourist' | 'commercial' | 'food' | 'lodging' | 'locate' | 'reset'
  >('all');
  const [sectionTriggerNonce, setSectionTriggerNonce] = useState(0);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const triggerNav = (
    section:
      | 'all'
      | 'tourist'
      | 'commercial'
      | 'food'
      | 'lodging'
      | 'locate'
      | 'reset'
  ) => {
    setRequestedSection(section);
    setSectionTriggerNonce((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            triggerNav('reset');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Novo Oriente Map
        </a>

        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => triggerNav('all')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => triggerNav('tourist')}
            className="hover:text-teal-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Turismo
          </button>
          <button
            type="button"
            onClick={() => triggerNav('food')}
            className="hover:text-amber-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Gastronomia
          </button>
          <button
            type="button"
            onClick={() => triggerNav('lodging')}
            className={`hover:text-rose-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer`}
          >
            Pousadas
          </button>
          <button
            type="button"
            onClick={() => triggerNav('commercial')}
            className="hover:text-blue-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Comércio
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => triggerNav('reset')}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Centralizar Cidade
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2 shadow-xs">
              <h2 className="text-base font-bold text-slate-900">
                Chave do Google Maps não configurada
              </h2>
              <p className="text-sm text-slate-600">
                Configure a variável <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> para carregar o mapa interativo de Novo Oriente de Minas.
              </p>
            </div>
          </div>
        ) : (
          <APIProvider
            apiKey={GOOGLE_MAPS_API_KEY}
            language="pt-BR"
            region="BR"
            libraries={['places', 'marker', 'routes']}
          >
            <MapsStatusGuard>
              <InteractiveMap
                requestedSection={requestedSection}
                sectionTriggerNonce={sectionTriggerNonce}
              />
            </MapsStatusGuard>
          </APIProvider>
        )}
      </main>
    </div>
  );
}
