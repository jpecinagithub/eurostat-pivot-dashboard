import { useEffect, useMemo, useState } from 'react'
import { CURATED_PACK } from '../config/curatedPack'
import { geoLabelEs } from '../config/labelsEs'
import { fmtEs } from '../engine/derivedMetrics'
import type { PivotTable } from '../engine/pivotEngine'
import { buildPanelView } from '../features/panelModel'
import { buildPanelUrl } from '../features/panelUrlCodec'
import { t, type UiLang } from '../i18n/dictionaries'
import { EurostatApiError, fetchDataset } from '../services/eurostatClient'
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

const PALETTE = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2']

/**
 * Gráfico de líneas SVG propio (sin librería): series por fila cuando
 * el tiempo está en columnas. La serie del agregado UE va discontinua
 * y en oscuro — es la referencia, no un país más (RF-26). La tabla de
 * debajo es su gemela accesible: el gráfico nunca es la única vía.
 */
function LineChart({ table }: { table: PivotTable }) {
  const timeOnCols = table.colDims.includes('time')
  if (!timeOnCols || table.colKeys.length < 2) return null
  const periods = table.colKeys.map((k) => k[table.colDims.indexOf('time')])
  const all = table.cells.flat().map((c) => c.value).filter((v): v is number => v !== null)
  if (all.length === 0) return null
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const W = 640
  const H = 220
  const PAD = 8
  const x = (j: number) => PAD + (j / (periods.length - 1)) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD)

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl border bg-white shadow-sm"
        role="img"
        aria-label={`Gráfico de líneas: ${table.rowKeys.map((k) => k.join(' ')).join(', ')}`}
      >
        {table.rowKeys.map((rk, i) => {
          const isRef = rk.includes('EU27_2020')
          const points = table.cells[i]
            .map((c, j) => (c.value === null ? null : `${x(j)},${y(c.value)}`))
            .filter(Boolean)
            .join(' ')
          return (
            <polyline
              key={rk.join()}
              points={points}
              fill="none"
              stroke={isRef ? '#0b1f3a' : PALETTE[i % PALETTE.length]}
              strokeWidth={isRef ? 2.5 : 1.8}
              strokeDasharray={isRef ? '6 4' : undefined}
            />
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
                background: rk.includes('EU27_2020') ? '#0b1f3a' : PALETTE[i % PALETTE.length],
              }}
            />
            {rk.join(' · ')}
          </span>
        ))}
        <span className="ml-auto">
          {periods[0]} – {periods[periods.length - 1]} · mín {fmtEs(min)} · máx {fmtEs(max)}
        </span>
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
export default function Panel() {
  const uiLang: UiLang = useAppStore((s) => s.uiLang)
  const spec = useAppStore((s) => s.builderSpec)

  const [parsed, setParsed] = useState<ParsedDataset | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState<{ rows: string[]; columns: string[] } | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!spec) return
    let alive = true
    setLoading(true)
    setError(null)
    setParsed(null)
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
  const view = useMemo(
    () =>
      parsed && spec && layout
        ? buildPanelView(parsed, spec, layout, card, card?.titleEs ?? spec.dataset)
        : null,
    [parsed, spec, layout, card],
  )

  if (!spec) return null

  const unitCode = spec.filters['unit']?.[0]
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
    <section aria-label={t(uiLang, 'panel.title')} className="mt-12">
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
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {t(uiLang, errorKey(error) as never)}
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

          {view.sentence && <p className="mt-3 max-w-3xl text-sm leading-relaxed">{view.sentence}</p>}

          {(view.referenceLast || view.meanLast) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {view.referenceLast && (
                <p className="rounded-lg bg-slate-100 px-3 py-2">
                  {view.referenceLast.label} ({view.lastPeriod}):{' '}
                  <strong>{fmtEs(view.referenceLast.value)}</strong>
                </p>
              )}
              {view.meanLast && (
                <p className="rounded-lg bg-amber-50 px-3 py-2">
                  {view.meanLast.label} ({view.lastPeriod}):{' '}
                  <strong>{fmtEs(view.meanLast.value)}</strong> · n={view.meanLast.n}
                </p>
              )}
            </div>
          )}

          <LineChart table={view.table} />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50"
              onClick={() =>
                setLayout((l) => (l ? { rows: l.columns, columns: l.rows } : l))
              }
            >
              {t(uiLang, 'panel.transpose')}
            </button>
            <button
              type="button"
              className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50"
              onClick={() => setShareUrl(buildPanelUrl(window.location.href, spec))}
            >
              {t(uiLang, 'panel.share')}
            </button>
          </div>
          {shareUrl && (
            <div className="mt-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label={t(uiLang, 'panel.share')}
                className="w-full rounded-md border bg-slate-50 px-3 py-2 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <p className="mt-1 text-xs opacity-70">{t(uiLang, 'panel.shareHint')}</p>
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
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
                                className="ml-0.5 text-[10px] text-amber-700"
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
                  <sup className="text-amber-700">{code}</sup> {label}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
