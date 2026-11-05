import { Analytics } from '@vercel/analytics/react'
import { useEffect } from 'react'
import Builder from './components/Builder'
import Dashboard from './components/Dashboard'
import Panel from './components/Panel'
import Home from './components/Home'
import { SafeSection } from './components/SafeSection'
import { CURATED_PACK } from './config/curatedPack'
import { dashboardFromSearch, specFromSearch } from './features/panelUrlCodec'
import { t } from './i18n/dictionaries'
import { useAppStore } from './store/dashboardStore'

/**
 * EUROPIVOT — cáscara: marca, propósito (C0), idioma y pie con la
 * atribución a Eurostat. La Home (buscador, temas, pack) es T07;
 * el constructor pivot llega en T08 y el hito M1 en T09b (SDD §5).
 *
 * Arranque desde enlace (T09b): si la URL trae `?p=` con una spec de
 * panel válida, la app abre directamente ese panel — la prueba de
 * «navegador limpio» de M1. Una URL manipulada decodifica a null y
 * la app arranca normal, sin panel.
 */
export default function App() {
  const uiLang = useAppStore((s) => s.uiLang)
  const setUiLang = useAppStore((s) => s.setUiLang)
  const setSelectedDataset = useAppStore((s) => s.setSelectedDataset)
  const setBuilderSpec = useAppStore((s) => s.setBuilderSpec)
  const setDashboard = useAppStore((s) => s.setDashboard)

  useEffect(() => {
    // El enlace manda sobre lo guardado: primero el dashboard (`?d=`,
    // T11); si no, el panel suelto de M1 (`?p=`, T09b) — que sigue
    // abriendo exactamente igual que cuando se creó.
    const shared = dashboardFromSearch(window.location.search)
    if (shared) {
      // P1 (QA 2026-11-05): el dashboard del enlace entra en SOLO
      // CONSULTA (shared: true) — no sobrescribe el guardado del
      // visitante. Título, visualización y ancho viajan en el enlace.
      setDashboard(
        {
          id: 'shared',
          name: shared.name ?? 'Mi dashboard',
          panels: shared.panels.map((panel, i) => ({
            id: `shared-${i}`,
            title:
              panel.title ??
              CURATED_PACK.find((c) => c.code === panel.spec.dataset)?.titleEs ??
              panel.spec.dataset,
            viz: panel.viz ?? ('line' as const),
            spec: panel.spec,
            rect: { x: 0, y: i, w: panel.wide ? 2 : 1, h: 1 },
          })),
        },
        { shared: true },
      )
      setSelectedDataset(shared.specs[0].dataset)
      setBuilderSpec(shared.specs[0])
      return
    }
    const spec = specFromSearch(window.location.search)
    if (spec) {
      setSelectedDataset(spec.dataset)
      setBuilderSpec(spec)
    }
    // Solo al montar: el enlace de entrada manda una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-8">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-2xl font-bold tracking-tight">EURO<span className="bg-[linear-gradient(135deg,#f97316,#ea580c)] bg-clip-text text-transparent">PIVOT</span></p>
          <p className="mt-1 max-w-xl text-sm opacity-80">{t(uiLang, 'app.tagline')}</p>
        </div>
        <div className="flex shrink-0 gap-1 text-sm" role="group" aria-label="Idioma / Language">
          {(['es', 'en'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setUiLang(lang)}
              aria-pressed={uiLang === lang}
              className={`rounded-md border px-2.5 py-1 uppercase ${
                uiLang === lang ? 'bg-[#f97316] font-semibold text-white' : 'bg-[#10142a]'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </header>

      <main className="mt-10 flex-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(uiLang, 'home.title')}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-80">
          {t(uiLang, 'app.scaffoldNote')}
        </p>

        <Home />
        <SafeSection label="constructor" fallbackText={t(uiLang, 'section.failed')}>
          <Builder />
        </SafeSection>
        <SafeSection label="panel" fallbackText={t(uiLang, 'section.failed')}>
          <Panel />
        </SafeSection>
        <SafeSection label="dashboard" fallbackText={t(uiLang, 'section.failed')}>
          <Dashboard />
        </SafeSection>
      </main>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs opacity-70">
        <span>{t(uiLang, 'app.dataSource')} · EUROPIVOT</span>
        <span>
          {t(uiLang, 'app.author')} ·{' '}
          <a className="underline" href="mailto:jpecina@gmail.com">
            jpecina@gmail.com
          </a>
        </span>
      </footer>

      {/* Vercel Analytics: código integrado (RNF-03); la activación en el
          dashboard de Vercel la hace Jon. */}
      <Analytics />
    </div>
  )
}
