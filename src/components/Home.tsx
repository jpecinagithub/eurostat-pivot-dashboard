import { useEffect, useMemo, useState } from 'react'
import { CURATED_PACK } from '../config/curatedPack'
import { fmtDateEs, packCardsWithMetadata, topThemes } from '../features/homeModel'
import { M1_SPEC, buildPanelUrl } from '../features/panelUrlCodec'
import { t, type UiLang } from '../i18n/dictionaries'
import {
  filterByTheme,
  loadCatalogueIndex,
  searchCatalogue,
  type CatalogueEntry,
  type CatalogueIndex,
} from '../services/catalogueService'
import { useAppStore } from '../store/dashboardStore'

const PACK_CODES = new Set(CURATED_PACK.map((c) => c.code))
const MAX_LIST = 40

function EntryRow({
  entry,
  lang,
  onSelect,
  selected,
}: {
  entry: CatalogueEntry
  lang: UiLang
  onSelect: (code: string) => void
  selected: boolean
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-[#10142a] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.title}</p>
        <p className="mt-0.5 text-xs opacity-70">
          <code className="font-mono">{entry.code}</code>
          {PACK_CODES.has(entry.code) && (
            <span className="ml-2 rounded bg-[#34d399]/15 px-1.5 py-0.5 font-semibold text-[#34d399]">
              {t(lang, 'home.inPack')}
            </span>
          )}
          {entry.lastUpdate && (
            <span className="ml-2">
              {t(lang, 'home.updated')}: {fmtDateEs(entry.lastUpdate) ?? entry.lastUpdate}
            </span>
          )}
          {entry.values !== undefined && (
            <span className="ml-2">
              {entry.values.toLocaleString('es-ES')} {t(lang, 'home.values')}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSelect(entry.code)}
        aria-pressed={selected}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
          selected ? 'bg-[#f97316] text-white' : 'bg-[#10142a] hover:bg-[#151b38]'
        }`}
      >
        {selected ? t(lang, 'home.selected') : t(lang, 'home.openBuilder')}
      </button>
    </li>
  )
}

/**
 * EUROPIVOT — Home (T07): buscador sobre el índice estático (T04),
 * temas reales del catálogo y tarjetas del pack verificado con la
 * fecha de actualización DESDE METADATOS (RF-22). El constructor
 * que consume la selección llega en T08.
 */
export default function Home() {
  const uiLang = useAppStore((s) => s.uiLang)
  const selectedDataset = useAppStore((s) => s.selectedDataset)
  const setSelectedDataset = useAppStore((s) => s.setSelectedDataset)
  const setBuilderSpec = useAppStore((s) => s.setBuilderSpec)
  const requestBuilderScroll = useAppStore((s) => s.requestBuilderScroll)

  /** Elegir un dataset lleva la vista al constructor (QA móvil). */
  const chooseDataset = (code: string) => {
    setSelectedDataset(code)
    requestBuilderScroll()
  }

  const openM1 = () => {
    setSelectedDataset(M1_SPEC.dataset)
    setBuilderSpec(M1_SPEC)
    // La URL queda lista para copiar y compartir (prueba M1).
    window.history.replaceState(null, '', buildPanelUrl(window.location.href, M1_SPEC))
  }

  const [index, setIndex] = useState<CatalogueIndex | null>(null)
  const [indexError, setIndexError] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadCatalogueIndex()
      .then((idx) => {
        if (alive) setIndex(idx)
      })
      .catch(() => {
        if (alive) setIndexError(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const themes = useMemo(() => (index ? topThemes(index) : []), [index])
  const packCards = useMemo(() => packCardsWithMetadata(index), [index])

  const results: CatalogueEntry[] = useMemo(() => {
    if (!index) return []
    if (query.trim().length >= 2) return searchCatalogue(index, query, MAX_LIST)
    if (theme) return filterByTheme(index, theme).slice(0, MAX_LIST)
    return []
  }, [index, query, theme])

  const searching = query.trim().length >= 2
  const browsing = !searching && theme !== null

  return (
    <div>
      {/* Buscador */}
      <div className="mt-8">
        <label htmlFor="catalogue-search" className="sr-only">
          {t(uiLang, 'home.searchLabel')}
        </label>
        <input
          id="catalogue-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(uiLang, 'home.searchPlaceholder')}
          className="w-full rounded-xl border bg-[#10142a] px-4 py-3 text-base outline-none focus:ring-2 focus:ring-[#f97316]"
        />
        {!index && !indexError && (
          <p className="mt-2 text-xs opacity-70" role="status">
            {t(uiLang, 'home.loading')}
          </p>
        )}
      </div>

      {/* Acceso directo al hito M1 (T09b) */}
      <div className="mt-6 rounded-xl border border-[#f97316]/25 bg-[linear-gradient(135deg,#141a36,#241a10)] p-4">
        <button
          type="button"
          onClick={openM1}
          className="rounded-md bg-[linear-gradient(135deg,#f97316,#ea580c)] px-4 py-2 text-sm font-semibold text-white"
        >
          {t(uiLang, 'home.m1Button')}
        </button>
        <p className="mt-2 text-xs opacity-80">{t(uiLang, 'home.m1Note')}</p>
      </div>

      {/* Temas reales del catálogo */}
      {themes.length > 0 && (
        <nav aria-label={t(uiLang, 'nav.themes')} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                onClick={() => setTheme(null)}
                aria-pressed={theme === null}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  theme === null ? 'bg-[#f97316] text-white' : 'bg-[#10142a]'
                }`}
              >
                {t(uiLang, 'home.themeAll')}
              </button>
            </li>
            {themes.map((th) => (
              <li key={th.name}>
                <button
                  type="button"
                  onClick={() => setTheme(th.name)}
                  aria-pressed={theme === th.name}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    theme === th.name ? 'bg-[#f97316] text-white' : 'bg-[#10142a]'
                  }`}
                >
                  {uiLang === 'es' ? th.labelEs : th.name} · {th.count.toLocaleString('es-ES')}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Resultados de búsqueda o de tema */}
      {(searching || browsing) && (
        <section aria-label={t(uiLang, 'home.results')} className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide uppercase opacity-70">
            {t(uiLang, 'home.results')} ({results.length})
          </h2>
          {index && results.length === 0 ? (
            <p className="mt-3 text-sm opacity-80">{t(uiLang, 'home.noResults')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {results.map((entry) => (
                <EntryRow
                  key={entry.code}
                  entry={entry}
                  lang={uiLang}
                  onSelect={chooseDataset}
                  selected={selectedDataset === entry.code}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedDataset && (
        <p className="mt-4 rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-2 text-sm text-[#fcd34d]" role="status">
          <code className="font-mono font-semibold">{selectedDataset}</code> —{' '}
          {t(uiLang, 'home.builderSoon')}
        </p>
      )}

      {/* Pack verificado */}
      <section aria-label={t(uiLang, 'home.packTitle')} className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">{t(uiLang, 'home.packTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm opacity-80">{t(uiLang, 'home.packNote')}</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packCards.map((card) => (
            <li key={card.code} className="flex flex-col rounded-xl border bg-[#10142a] p-4">
              <p className="text-sm font-semibold">{card.titleEs}</p>
              <p className="mt-1 text-xs opacity-70">
                <code className="font-mono">{card.code}</code> · {card.freq}
                {card.lastPeriod && (
                  <>
                    {' '}
                    · {t(uiLang, 'home.dataUntil')} {card.lastPeriod}
                  </>
                )}
              </p>
              <p className="mt-1 text-xs opacity-70">
                {card.updatedMeta
                  ? `${t(uiLang, 'home.updated')}: ${fmtDateEs(card.updatedMeta) ?? card.updatedMeta}`
                  : `${t(uiLang, 'home.updated')}: …`}
                {card.values !== undefined &&
                  ` · ${card.values.toLocaleString('es-ES')} ${t(uiLang, 'home.values')}`}
              </p>
              <button
                type="button"
                onClick={() => chooseDataset(card.code)}
                aria-pressed={selectedDataset === card.code}
                className={`mt-3 rounded-md border px-3 py-1.5 text-xs font-medium ${
                  selectedDataset === card.code
                    ? 'bg-[#f97316] text-white'
                    : 'bg-[#10142a] hover:bg-[#151b38]'
                }`}
              >
                {selectedDataset === card.code
                  ? t(uiLang, 'home.selected')
                  : t(uiLang, 'home.openBuilder')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
