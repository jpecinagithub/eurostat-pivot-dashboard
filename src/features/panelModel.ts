import type { DatasetCard, PivotSpec, ValidOps } from '../core/types'
import {
  aggregate,
  officialReference,
  summarySentence,
  type SeriesPoint,
} from '../engine/derivedMetrics'
import { pivot, type PivotTable } from '../engine/pivotEngine'
import type { ParsedDataset } from '../services/jsonstatParser'

/**
 * EUROPIVOT — Modelo del panel (T09). De la respuesta parseada a todo
 * lo que el panel pinta: tabla, contexto RF-31, referencia oficial,
 * media rotulada y frase. Puro y testeable; el componente solo pinta.
 *
 * Repivotar (cambiar filas/columnas) recalcula desde las MISMAS filas
 * tidy: este modelo no conoce la red (C4/RF-08).
 */

const NEUTRAL_OPS: ValidOps = {
  sum: false,
  mean: false,
  median: false,
  minMax: false,
  deltaPct: false,
  deltaPp: false,
  cagr: false,
  index100: false,
  ranking: false,
}

/**
 * Reglas de cálculo aplicables a esta spec: las de la ficha del pack
 * para la unidad/indicador elegidos. Sin ficha (o sin reglas para esa
 * unidad) → NEUTRAL_OPS: el panel muestra datos, pero no deriva nada
 * que nadie haya validado (C13/C14).
 */
export function opsForSpec(spec: PivotSpec, card?: DatasetCard): ValidOps {
  if (!card) return NEUTRAL_OPS
  const unit = spec.filters['unit']?.[0]
  if (unit && card.validOps[unit]) return card.validOps[unit]
  for (const codes of Object.values(spec.filters)) {
    for (const code of codes) {
      if (card.validOps[code]) return card.validOps[code]
    }
  }
  return NEUTRAL_OPS
}

export interface PanelView {
  table: PivotTable
  ops: ValidOps
  /** Periodos presentes en la tabla (eje temporal, esté donde esté). */
  periods: string[]
  lastPeriod?: string
  /** Serie del foco (ES si está; si no, la primera geo) para la frase. */
  focus?: { geo: string; series: SeriesPoint[] }
  /** Agregado oficial en el último periodo, si la tabla trae la fila UE. */
  referenceLast?: { label: string; value: number }
  /** Media simple de países (sin la fila de referencia) en el último periodo. */
  meanLast?: { label: string; value: number; n: number; excludedMissing: number }
  sentence?: string
}

function timeAxis(table: PivotTable): { on: 'rows' | 'cols'; periods: string[] } | null {
  if (table.colDims.includes('time')) {
    const pos = table.colDims.indexOf('time')
    return { on: 'cols', periods: table.colKeys.map((k) => k[pos]) }
  }
  if (table.rowDims.includes('time')) {
    const pos = table.rowDims.indexOf('time')
    return { on: 'rows', periods: table.rowKeys.map((k) => k[pos]) }
  }
  return null
}

function seriesForGeo(table: PivotTable, geo: string): SeriesPoint[] | null {
  const axis = timeAxis(table)
  if (!axis) return null
  if (axis.on === 'cols') {
    const geoPos = table.rowDims.indexOf('geo')
    if (geoPos < 0) return null
    const i = table.rowKeys.findIndex((k) => k[geoPos] === geo)
    if (i < 0) return null
    return axis.periods.map((period, j) => ({ period, value: table.cells[i][j].value }))
  }
  const geoPos = table.colDims.indexOf('geo')
  if (geoPos < 0) return null
  const j = table.colKeys.findIndex((k) => k[geoPos] === geo)
  if (j < 0) return null
  return axis.periods.map((period, i) => ({ period, value: table.cells[i][j].value }))
}

function geoCodes(table: PivotTable): string[] {
  if (table.rowDims.includes('geo')) {
    const pos = table.rowDims.indexOf('geo')
    return table.rowKeys.map((k) => k[pos])
  }
  if (table.colDims.includes('geo')) {
    const pos = table.colDims.indexOf('geo')
    return table.colKeys.map((k) => k[pos])
  }
  return []
}

export function buildPanelView(
  parsed: ParsedDataset,
  spec: PivotSpec,
  layout: { rows: string[]; columns: string[] },
  card?: DatasetCard,
  titleForSentence?: string,
): PanelView {
  const table = pivot(parsed.rows, parsed.schema, layout)
  const ops = opsForSpec(spec, card)
  const axis = timeAxis(table)
  const periods = axis?.periods ?? []
  const lastPeriod = periods[periods.length - 1]

  const view: PanelView = { table, ops, periods, lastPeriod }

  const geos = geoCodes(table)
  const focusGeo = geos.includes('ES') ? 'ES' : geos[0]
  const reference = officialReference(table)

  if (focusGeo) {
    const series = seriesForGeo(table, focusGeo)
    if (series) view.focus = { geo: focusGeo, series }
  }

  if (lastPeriod) {
    // Referencia oficial en el último periodo (dato de Eurostat).
    if (reference) {
      const idx = axis?.on === 'cols' ? periods.indexOf(lastPeriod) : undefined
      const value =
        axis?.on === 'cols' && idx !== undefined
          ? reference.values[idx]
          : axis?.on === 'rows'
            ? reference.values[periods.indexOf(lastPeriod)]
            : null
      if (value !== null && value !== undefined) {
        view.referenceLast = { label: reference.label, value }
      }
    }
    // Media simple SOLO de países: la fila del agregado oficial no es
    // un país y no entra en la media (sería contar la UE dos veces).
    const countryValues: (number | null)[] = []
    for (const geo of geos) {
      if (reference && geo === reference.key) continue
      const s = seriesForGeo(table, geo)
      const point = s?.find((p) => p.period === lastPeriod)
      if (point) countryValues.push(point.value)
    }
    if (countryValues.length > 0) {
      const mean = aggregate(countryValues, 'mean', ops)
      if (mean.ok && mean.value.value !== null) {
        view.meanLast = {
          label: mean.value.label,
          value: mean.value.value,
          n: mean.value.n,
          excludedMissing: mean.value.excludedMissing,
        }
      }
    }
  }

  if (view.focus && titleForSentence) {
    const unitCode = spec.filters['unit']?.[0] ?? ''
    const sentence = summarySentence({
      subject: `${titleForSentence} · ${view.focus.geo}`,
      unitLabel: unitCode,
      series: view.focus.series,
      ops,
      reference:
        view.referenceLast && lastPeriod && !(reference && view.focus.geo === reference.key)
          ? { value: view.referenceLast.value, period: lastPeriod }
          : undefined,
      panelMean:
        view.meanLast && lastPeriod
          ? { value: view.meanLast.value, period: lastPeriod }
          : undefined,
    })
    if (sentence) view.sentence = sentence
  }

  return view
}
