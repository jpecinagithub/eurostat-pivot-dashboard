import { useEffect, useMemo, useState } from 'react'
import { CURATED_PACK } from '../config/curatedPack'
import type { PivotSpec, VizType } from '../core/types'
import { dimLabelEs, geoLabelEs } from '../config/labelsEs'
import { fmtEs } from '../engine/derivedMetrics'
import { PivotAmbiguityError, type PivotTable } from '../engine/pivotEngine'
import {
  buildChoropleth,
  europeProjector,
  geoJsonToShapes,
  nutsLevelForCodes,
  CLASS_COLORS,
  NO_DATA_COLOR,
  type RegionShape,
} from '../features/mapModel'
import { buildPanelView } from '../features/panelModel'
import { buildPanelUrl } from '../features/panelUrlCodec'
import { t, type UiLang } from '../i18n/dictionaries'
import { EurostatApiError, fetchDataset } from '../services/eurostatClient'
import { fetchNutsGeoJson } from '../services/geoService'
import { parseJsonStat, type ParsedDataset } from '../services/jsonstatParser'

/** Etiqueta legible de una clave de fila/columna: nombre ES de geo si
 *  lo hay; si no, la etiqueta oficial que trae la propia respuesta
 *  JSON-stat (T03); el código queda en el atributo title. */
function keyLabel(parsed: ParsedDataset, dims: string[], tuple: string[]): string {
  return tuple
    .map((code, i) => {
      if (dims[i] === 'geo') return geoLabelEs(code) ?? labelFromSchema(parsed, dims[i], code) ?? code
      return labelFromSchema(parsed, dims[i], code) ?? code
    })
    .join(' · ')
}

function labelFromSchema(parsed: ParsedDataset, dim: string, code: string): string | undefined {
  const d = parsed.schema.dims.find((x) => x.id === dim)
  const cat = d?.categories.find((c) => c.code === code)
  return cat && cat.label !== cat.code ? cat.label : undefined
}
import { useAppStore } from '../store/dashboardStore'

const PALETTE = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#f97316', '#94a3b8']

/**
 * Gráfico de líneas SVG propio (sin librería): series por fila cuando
 * el tiempo está en columnas. La serie del agregado UE va discontinua
 * y en naranja claro — es la referencia, no un país más (RF-26). Con
 * ejes de verdad: ticks «bonitos» en Y con rejilla, periodos en X y el
 * valor final de cada serie junto a su último punto (≤6 series). La
 * tabla de debajo es su gemela accesible: el gráfico nunca es la
 * única vía.
 */
export function niceTicks(min: number, max: number, count = 4): { lo: number; hi: number; ticks: number[] } {
  if (min === max) {
    min -= 1
    max += 1
  }
  const rawStep = (max - min) / count
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Number(v.toFixed(6)))
  return { lo, hi, ticks }
}

function LineChart({
  table,
  labelFor,
}: {
  table: PivotTable
  labelFor: (rk: string[]) => string
}) {
  const timeOnCols = table.colDims.includes('time')
  if (!timeOnCols || table.colKeys.length < 2) return null
  const periods = table.colKeys.map((k) => k[table.colDims.indexOf('time')])
  const all = table.cells.flat().map((c) => c.value).filter((v): v is number => v !== null)
  if (all.length === 0) return null
  const { lo, hi, ticks } = niceTicks(Math.min(...all), Math.max(...all))
  const decimals = ticks.length > 1 && ticks[1] - ticks[0] < 1 ? 1 : 0
  const W = 640
  const H = 250
  const LEFT = 50
  const RIGHT = 14
  const TOP = 12
  const BOTTOM = 26
  const plotW = W - LEFT - RIGHT
  const plotH = H - TOP - BOTTOM
  const x = (j: number) => LEFT + (j / (periods.length - 1)) * plotW
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH
  const xStep = Math.max(1, Math.ceil(periods.length / 8))
  const axisColor = 'rgba(255,255,255,0.18)'
  const gridColor = 'rgba(255,255,255,0.08)'
  const labelColor = '#8f97b5'

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl border bg-[#10142a]"
        role="img"
        aria-label={`Gráfico de líneas: ${table.rowKeys.map((k) => labelFor(k)).join(', ')}`}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={LEFT} x2={LEFT + plotW} y1={y(tv)} y2={y(tv)} stroke={gridColor} strokeWidth={1} />
            <text x={LEFT - 6} y={y(tv) + 3} textAnchor="end" fontSize={10} fill={labelColor}>
              {fmtEs(tv, decimals)}
            </text>
          </g>
        ))}
        <line x1={LEFT} x2={LEFT} y1={TOP} y2={TOP + plotH} stroke={axisColor} strokeWidth={1} />
        <line x1={LEFT} x2={LEFT + plotW} y1={TOP + plotH} y2={TOP + plotH} stroke={axisColor} strokeWidth={1} />
        {periods.map((p, j) =>
          j % xStep === 0 || j === periods.length - 1 ? (
            <text key={p} x={x(j)} y={H - 8} textAnchor="middle" fontSize={10} fill={labelColor}>
              {p}
            </text>
          ) : null,
        )}
        {table.rowKeys.map((rk, i) => {
          const isRef = rk.includes('EU27_2020')
          const color = isRef ? '#fb923c' : PALETTE[i % PALETTE.length]
          const points = table.cells[i]
            .map((c, j) => (c.value === null ? null : `${x(j)},${y(c.value)}`))
            .filter(Boolean)
            .join(' ')
          let lastIdx = -1
          table.cells[i].forEach((c, j) => {
            if (c.value !== null) lastIdx = j
          })
          const lastVal = lastIdx >= 0 ? table.cells[i][lastIdx].value : null
          return (
            <g key={rk.join()}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={isRef ? 2.5 : 1.8}
                strokeDasharray={isRef ? '6 4' : undefined}
              />
              {lastVal !== null && table.rowKeys.length <= 6 && (
                <text
                  x={x(lastIdx)}
                  y={Math.max(10, y(lastVal) - 7)}
                  textAnchor="end"
                  fontSize={10.5}
                  fontWeight={600}
                  fill={color}
                >
                  {fmtEs(lastVal)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
        {table.rowKeys.map((rk, i) => (
          <span key={rk.join()}>
            <span
              aria-hidden
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{
                background: rk.includes('EU27_2020') ? '#fb923c' : PALETTE[i % PALETTE.length],
              }}
            />
            {labelFor(rk)}
          </span>
        ))}
        <span className="ml-auto">
          {periods[0]} – {periods[periods.length - 1]} · mín {fmtEs(Math.min(...all))} · máx{' '}
          {fmtEs(Math.max(...all))}
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * Mapa coroplético SVG propio (T10, RF-16): geometrías GISCO/NUTS
 * proyectadas en cliente, join literal por código, clases de color con
 * leyenda numérica y «sin datos» distinguible. Los agregados no se
 * pintan: van en la lista de al lado. La tabla sigue siendo la gemela
 * accesible del mapa (RNF-06).
 */
function ChoroplethMap({
  shapes,
  table,
  period,
  labelFor,
  uiLang,
}: {
  shapes: Map<string, RegionShape>
  table: PivotTable
  period: string
  labelFor: (code: string) => string
  uiLang: UiLang
}) {
  const choro = useMemo(() => buildChoropleth(table, shapes, period), [table, shapes, period])
  if (!choro) return null
  const proj = europeProjector()
  const ordered = [...shapes.values()].sort((a, b) => {
    const fa = choro.fills.has(a.id) ? 1 : 0
    const fb = choro.fills.has(b.id) ? 1 : 0
    return fa - fb
  })
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${proj.width} ${proj.height}`}
        className="w-full rounded-xl border bg-[#0d1122]"
        role="img"
        aria-label={`${t(uiLang, 'panel.map.title')}: ${period}`}
      >
        {ordered.map((s) => {
          const fill = choro.fills.get(s.id)
          return (
            <path
              key={s.id}
              d={s.path}
              fill={fill ? CLASS_COLORS[fill.classIndex] : NO_DATA_COLOR}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={0.5}
            >
              <title>
                {labelFor(s.id)}: {fill ? fmtEs(fill.value) : t(uiLang, 'panel.map.noData')}
              </title>
            </path>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs opacity-80">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {choro.classes.map((c, i) => (
            <span key={i}>
              <span
                aria-hidden
                className="mr-1 inline-block h-2 w-2 rounded-sm"
                style={{ background: c.color }}
              />
              {fmtEs(c.from)} – {fmtEs(c.to)}
            </span>
          ))}
          <span>
            <span
              aria-hidden
              className="mr-1 inline-block h-2 w-2 rounded-sm"
              style={{ background: NO_DATA_COLOR }}
            />
            {t(uiLang, 'panel.map.noData')} ({choro.noData})
          </span>
        </span>
        {choro.aside.length > 0 && (
          <span className="mt-1 block">
            {t(uiLang, 'panel.map.aside')}:{' '}
            {choro.aside.map((a) => `${labelFor(a.code)}: ${fmtEs(a.value)}`).join(' · ')}
          </span>
        )}
        <span className="mt-1 block opacity-70">{t(uiLang, 'panel.map.geoSource')}</span>
      </figcaption>
    </figure>
  )
}

function errorKey(error: unknown): string {
  if (error instanceof EurostatApiError) {
    switch (error.kind) {
      case 'no_results':
        return 'panel.err.no_results'
      case 'too_big':
        return 'panel.err.too_big'
      case 'in_preparation':
        return 'panel.err.in_preparation'
      case 'network':
        return 'panel.err.network'
      default:
        return 'panel.err.generic'
    }
  }
  return 'panel.err.generic'
}

/**
 * EUROPIVOT — Panel (T09): descarga UNA vez por spec (T02), parsea a
 * tidy (T03), pivota en cliente (T06) y pinta tabla + gráfico + frase
 * con el contexto obligatorio de RF-31. Transponer repivota desde las
 * mismas filas: no vuelve a la red (C4/RF-08).
 */
export default function Panel({
  spec: propSpec,
  viz,
}: { spec?: PivotSpec; viz?: VizType } = {}) {
  const uiLang: UiLang = useAppStore((s) => s.uiLang)
  const storeSpec = useAppStore((s) => s.builderSpec)
  const addPanel = useAppStore((s) => s.addPanel)
  const spec = propSpec ?? storeSpec

  const [parsed, setParsed] = useState<ParsedDataset | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState<{ rows: string[]; columns: string[] } | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [mapShapes, setMapShapes] = useState<Map<string, RegionShape> | null>(null)
  const [mapError, setMapError] = useState(false)
  const [mapPeriod, setMapPeriod] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!spec) return
    let alive = true
    setLoading(true)
    setError(null)
    setParsed(null)
    setShareUrl(null)
    setPinned(false)
    setLayout({ rows: spec.rows, columns: spec.columns })
    fetchDataset(spec)
      .then((raw) => {
        if (alive) setParsed(parseJsonStat(raw, spec.dataset))
      })
      .catch((e: unknown) => {
        if (alive) setError(e)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [spec])

  const card = spec ? CURATED_PACK.find((c) => c.code === spec.dataset) : undefined
  // Construir la vista NUNCA debe tumbar la app: una configuración
  // ambigua (varios valores en una dimensión no colocada) lanza en el
  // motor pivot, y ese error se pinta como aviso, no como pantallazo
  // vacío (regresión corregida 2026-11-05).
  const viewResult = useMemo(() => {
    if (!parsed || !spec || !layout) return null
    try {
      return {
        view: buildPanelView(parsed, spec, layout, card, card?.titleEs ?? spec.dataset),
        error: null as unknown,
      }
    } catch (e) {
      return { view: null, error: e }
    }
  }, [parsed, spec, layout, card])
  const view = viewResult?.view ?? null
  const viewError = viewResult?.error ?? null

  // --- Mapa (T10/RF-16): solo con la geografía sola en filas y el
  // tiempo en columnas; el nivel NUTS sale de los propios códigos.
  const geoRowCodes =
    view && view.table.rowDims.length === 1 && view.table.rowDims[0] === 'geo'
      ? view.table.rowKeys.map((k) => k[0])
      : null
  const mapLevel = geoRowCodes ? nutsLevelForCodes(geoRowCodes) : null
  const mapPeriods =
    view && view.table.colDims.includes('time')
      ? view.table.colKeys.map((ck) => ck[view.table.colDims.indexOf('time')])
      : []
  const effectiveMapPeriod =
    mapPeriod && mapPeriods.includes(mapPeriod)
      ? mapPeriod
      : mapPeriods[mapPeriods.length - 1]

  useEffect(() => {
    if (mapLevel === null) {
      setMapShapes(null)
      return
    }
    let alive = true
    setMapError(false)
    fetchNutsGeoJson(mapLevel)
      .then((fc) => {
        if (alive) setMapShapes(geoJsonToShapes(fc, europeProjector()))
      })
      .catch(() => {
        if (alive) setMapError(true)
      })
    return () => {
      alive = false
    }
  }, [mapLevel])

  if (!spec) return null

  const unitCode = spec.filters['unit']?.[0]
  // Países pedidos que la respuesta no trae (cero observaciones en
  // este corte): no desaparecen en silencio, se nombran — con otros
  // cortes (p. ej. otro tamaño de empresa) pueden sí tener datos.
  const missingGeos: string[] = []
  if (parsed && spec.filters['geo'] && !spec.geoLevel) {
    const present = new Set(parsed.rows.map((r) => r['geo']))
    for (const code of spec.filters['geo']) {
      if (!present.has(code)) missingGeos.push(code)
    }
  }
  const usedFlags = new Map<string, string>()
  if (view) {
    for (const row of view.table.cells) {
      for (const cell of row) {
        if (cell.status && parsed) {
          usedFlags.set(cell.status, parsed.meta.statusLabels[cell.status] ?? cell.status)
        }
      }
    }
  }

  return (
    <section aria-label={t(uiLang, 'panel.title')} className={propSpec ? '' : 'mt-12'}>
      <h2 className="text-lg font-semibold tracking-tight">
        {card?.titleEs ?? spec.dataset}{' '}
        <code className="font-mono text-sm font-normal opacity-70">{spec.dataset}</code>
      </h2>

      {loading && (
        <p className="mt-3 text-sm opacity-80" role="status">
          {t(uiLang, 'panel.loading')}
        </p>
      )}
      {error !== null && (
        <p className="mt-3 rounded-lg border border-[#f87171]/25 bg-[#f87171]/10 px-3 py-2 text-sm text-[#fca5a5]" role="alert">
          {t(uiLang, errorKey(error) as never)}
        </p>
      )}
      {viewError !== null && (
        <p className="mt-3 rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-2 text-sm" role="alert">
          {viewError instanceof PivotAmbiguityError
            ? t(uiLang, 'panel.err.ambiguous').replace(
                '{dim}',
                dimLabelEs(viewError.dim) ?? viewError.dim,
              )
            : t(uiLang, 'panel.err.generic')}
        </p>
      )}

      {view && parsed && (
        <div>
          {/* Contexto obligatorio RF-31: unidad, periodo, actualizado, fuente */}
          <p className="mt-2 text-xs opacity-80">
            {unitCode && (
              <>
                {t(uiLang, 'panel.unit')}: <strong>{unitCode}</strong> ·{' '}
              </>
            )}
            {t(uiLang, 'panel.period')}: {view.periods[0]} –{' '}
            {view.periods[view.periods.length - 1]} · {t(uiLang, 'panel.updated')}:{' '}
            {parsed.meta.updated
              ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                  new Date(parsed.meta.updated),
                )
              : '—'}{' '}
            · {t(uiLang, 'panel.source')}: Eurostat
          </p>

          {missingGeos.length > 0 && (
            <p className="mt-2 rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-2 text-xs">
              {t(uiLang, 'panel.noDataGeos')}:{' '}
              {missingGeos.map((c) => keyLabel(parsed, ['geo'], [c])).join(', ')}
            </p>
          )}

          {view.sentence && <p className="mt-3 max-w-3xl text-sm leading-relaxed">{view.sentence}</p>}

          {(view.referenceLast || view.meanLast) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {view.referenceLast && (
                <p className="rounded-lg bg-[#151b38] px-3 py-2">
                  {view.referenceLast.label} ({view.lastPeriod}):{' '}
                  <strong>{fmtEs(view.referenceLast.value)}</strong>
                </p>
              )}
              {view.meanLast && (
                <p className="rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-2">
                  {view.meanLast.label} ({view.lastPeriod}):{' '}
                  <strong>{fmtEs(view.meanLast.value)}</strong> · n={view.meanLast.n}
                </p>
              )}
            </div>
          )}

          {(viz === undefined || viz === 'line') && (
            <LineChart table={view.table} labelFor={(rk) => keyLabel(parsed, view.table.rowDims, rk)} />
          )}

          {(viz === undefined || viz === 'map') && geoRowCodes && mapPeriods.length > 0 && (
            <div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold">{t(uiLang, 'panel.map.title')}</h3>
                <label className="text-xs opacity-80">
                  {t(uiLang, 'panel.map.period')}{' '}
                  <select
                    value={effectiveMapPeriod}
                    onChange={(e) => setMapPeriod(e.target.value)}
                    className="rounded-md border bg-[#151b38] px-2 py-1 text-xs"
                  >
                    {mapPeriods.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {mapError ? (
                <p className="mt-2 text-sm text-[#fca5a5]" role="alert">
                  {t(uiLang, 'panel.map.error')}
                </p>
              ) : !mapShapes ? (
                <p className="mt-2 text-sm opacity-80" role="status">
                  {t(uiLang, 'panel.map.loading')}
                </p>
              ) : (
                effectiveMapPeriod && (
                  <ChoroplethMap
                    shapes={mapShapes}
                    table={view.table}
                    period={effectiveMapPeriod}
                    uiLang={uiLang}
                    labelFor={(code) => keyLabel(parsed, ['geo'], [code])}
                  />
                )
              )}
            </div>
          )}
          {(viz === undefined || viz === 'map') &&
            !geoRowCodes &&
            (view.table.rowDims.includes('geo') || view.table.colDims.includes('geo')) && (
              <p className="mt-3 text-xs opacity-70">{t(uiLang, 'panel.map.needLayout')}</p>
            )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md border bg-[#10142a] px-3 py-1.5 text-xs font-medium hover:bg-[#151b38]"
              onClick={() =>
                setLayout((l) => (l ? { rows: l.columns, columns: l.rows } : l))
              }
            >
              {t(uiLang, 'panel.transpose')}
            </button>
            <button
              type="button"
              className="rounded-md border bg-[#10142a] px-3 py-1.5 text-xs font-medium hover:bg-[#151b38]"
              onClick={() => setShareUrl(buildPanelUrl(window.location.href, spec))}
            >
              {t(uiLang, 'panel.share')}
            </button>
            {!propSpec && (
              <button
                type="button"
                disabled={pinned}
                className="rounded-md border bg-[#10142a] px-3 py-1.5 text-xs font-medium hover:bg-[#151b38] disabled:opacity-60"
                onClick={() => {
                  addPanel(spec, card?.titleEs ?? spec.dataset)
                  setPinned(true)
                }}
              >
                {pinned ? t(uiLang, 'panel.pinned') : t(uiLang, 'panel.pin')}
              </button>
            )}
          </div>
          {shareUrl && (
            <div className="mt-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label={t(uiLang, 'panel.share')}
                className="w-full rounded-md border bg-[#151b38] px-3 py-2 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <p className="mt-1 text-xs opacity-70">{t(uiLang, 'panel.shareHint')}</p>
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-xl border bg-[#10142a]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#151b38] text-left">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {view.table.rowDims.join(' · ')} \ {view.table.colDims.join(' · ')}
                  </th>
                  {view.table.colKeys.map((ck) => (
                    <th
                      key={ck.join()}
                      scope="col"
                      title={ck.join(' · ')}
                      className="px-3 py-2 text-right font-semibold"
                    >
                      {keyLabel(parsed, view.table.colDims, ck)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.table.rowKeys.map((rk, i) => (
                  <tr key={rk.join()} className="border-t">
                    <th
                      scope="row"
                      title={rk.join(' · ')}
                      className="px-3 py-1.5 text-left font-medium"
                    >
                      {keyLabel(parsed, view.table.rowDims, rk)}
                    </th>
                    {view.table.cells[i].map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 text-right tabular-nums">
                        {cell.value === null ? (
                          '—'
                        ) : (
                          <>
                            {fmtEs(cell.value)}
                            {cell.status && (
                              <sup
                                className="ml-0.5 text-[10px] text-[#fbbf24]"
                                title={parsed.meta.statusLabels[cell.status] ?? cell.status}
                              >
                                {cell.status}
                              </sup>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usedFlags.size > 0 && (
            <p className="mt-2 text-xs opacity-80">
              {[...usedFlags.entries()].map(([code, label]) => (
                <span key={code} className="mr-3">
                  <sup className="text-[#fbbf24]">{code}</sup> {label}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
