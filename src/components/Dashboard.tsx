import { useState } from 'react'
import { CURATED_PACK } from '../config/curatedPack'
import type { VizType } from '../core/types'
import { buildDashboardUrl } from '../features/panelUrlCodec'
import { t, type UiLang } from '../i18n/dictionaries'
import { useAppStore } from '../store/dashboardStore'
import Panel from './Panel'

/**
 * EUROPIVOT — Dashboard multipanel (T11, RF-17/18/19/20).
 *
 * Rejilla responsive de paneles INDEPENDIENTES (cada uno con su
 * PivotSpec completo; mezclar datasets es la decisión de Jon para
 * v1). Chrome por panel: título editable, tipo de visualización,
 * tamaño (normal/ancho), reordenar y quitar. Todo cambio persiste
 * solo en localStorage (RF-18/19, vía el store). Compartir genera la
 * URL `?d=` con la colección completa (RF-20).
 */
export default function Dashboard() {
  const uiLang: UiLang = useAppStore((s) => s.uiLang)
  const dashboard = useAppStore((s) => s.dashboard)
  const removePanel = useAppStore((s) => s.removePanel)
  const movePanel = useAppStore((s) => s.movePanel)
  const setPanelTitle = useAppStore((s) => s.setPanelTitle)
  const setPanelViz = useAppStore((s) => s.setPanelViz)
  const setPanelWide = useAppStore((s) => s.setPanelWide)
  const setDashboardName = useAppStore((s) => s.setDashboardName)
  const setDashboard = useAppStore((s) => s.setDashboard)
  const dashboardShared = useAppStore((s) => s.dashboardShared)
  const saveSharedDashboard = useAppStore((s) => s.saveSharedDashboard)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  if (!dashboard || dashboard.panels.length === 0) return null

  const vizOptions: { value: VizType; key: string }[] = [
    { value: 'line', key: 'dashboard.viz.line' },
    { value: 'map', key: 'dashboard.viz.map' },
    { value: 'table', key: 'dashboard.viz.table' },
  ]

  return (
    <section aria-label={t(uiLang, 'dashboard.title')} className="mt-14">
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-8">
        <input
          type="text"
          value={dashboard.name}
          onChange={(e) => setDashboardName(e.target.value)}
          aria-label={t(uiLang, 'dashboard.title')}
          className="rounded-md border bg-[#10142a] px-3 py-1.5 text-lg font-semibold tracking-tight"
        />
        <span className="text-xs opacity-70">
          {dashboardShared ? t(uiLang, 'dashboard.sharedNote') : t(uiLang, 'dashboard.saved')}
          {!dashboardShared &&
          dashboard.savedAt &&
          Number.isFinite(Date.parse(dashboard.savedAt))
            ? ` · ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dashboard.savedAt))}`
            : ''}
        </span>
        {dashboardShared && (
          <button
            type="button"
            className="rounded-md bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ea580c]"
            onClick={() => saveSharedDashboard()}
          >
            {t(uiLang, 'dashboard.saveCopy')}
          </button>
        )}
        <span className="w-full text-xs opacity-60">{t(uiLang, 'dashboard.freshNote')}</span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            className="rounded-md border bg-[#10142a] px-3 py-1.5 text-xs font-medium hover:bg-[#151b38]"
            onClick={() =>
              setShareUrl(
                buildDashboardUrl(
                  window.location.href,
                  dashboard.name,
                  dashboard.panels.map((p) => ({
                    spec: p.spec,
                    title: p.title,
                    viz: p.viz,
                    wide: p.rect.w === 2,
                  })),
                ),
              )
            }
          >
            {t(uiLang, 'dashboard.share')}
          </button>
          <button
            type="button"
            className="rounded-md border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-1.5 text-xs font-medium text-[#fca5a5] hover:bg-[#f87171]/20"
            onClick={() => {
              setDashboard(null)
              setShareUrl(null)
            }}
          >
            {t(uiLang, 'dashboard.clear')}
          </button>
        </span>
      </div>
      {shareUrl && (
        <div className="mt-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label={t(uiLang, 'dashboard.share')}
            className="w-full rounded-md border bg-[#151b38] px-3 py-2 font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
          <p className="mt-1 text-xs opacity-70">{t(uiLang, 'dashboard.shareHint')}</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {dashboard.panels.map((panel, i) => {
          const card = CURATED_PACK.find((c) => c.code === panel.spec.dataset)
          return (
            <article
              key={panel.id}
              className={`rounded-2xl border bg-[#0d1122] p-4 ${panel.rect.w === 2 ? 'xl:col-span-2' : ''}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={panel.title}
                  onChange={(e) => setPanelTitle(panel.id, e.target.value)}
                  aria-label={t(uiLang, 'dashboard.panelTitle')}
                  className="min-w-40 flex-1 rounded-md border bg-[#10142a] px-2 py-1 text-sm font-medium"
                />
                <select
                  value={panel.viz}
                  onChange={(e) => setPanelViz(panel.id, e.target.value as VizType)}
                  aria-label={t(uiLang, 'dashboard.viz.label')}
                  className="rounded-md border bg-[#151b38] px-2 py-1 text-xs"
                >
                  {vizOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(uiLang, o.key as never)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={t(uiLang, 'dashboard.wide')}
                  aria-pressed={panel.rect.w === 2}
                  className={`rounded-md border px-2 py-1 text-xs ${panel.rect.w === 2 ? 'bg-[#f97316] font-semibold text-white' : 'bg-[#10142a]'}`}
                  onClick={() => setPanelWide(panel.id, panel.rect.w !== 2)}
                >
                  {t(uiLang, 'dashboard.wide')}
                </button>
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={t(uiLang, 'dashboard.moveUp')}
                    disabled={i === 0}
                    className="rounded-md border bg-[#10142a] px-2 py-1 text-xs disabled:opacity-40"
                    onClick={() => movePanel(panel.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t(uiLang, 'dashboard.moveDown')}
                    disabled={i === dashboard.panels.length - 1}
                    className="rounded-md border bg-[#10142a] px-2 py-1 text-xs disabled:opacity-40"
                    onClick={() => movePanel(panel.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={t(uiLang, 'dashboard.remove')}
                    className="rounded-md border border-[#f87171]/40 bg-[#f87171]/10 px-2 py-1 text-xs text-[#fca5a5]"
                    onClick={() => removePanel(panel.id)}
                  >
                    ✕
                  </button>
                </span>
              </div>
              <p className="mb-1 font-mono text-[11px] opacity-60">
                {panel.spec.dataset}
                {card ? '' : ' · —'}
              </p>
              <Panel spec={panel.spec} viz={panel.viz} />
            </article>
          )
        })}
      </div>
    </section>
  )
}
