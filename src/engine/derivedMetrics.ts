import type { ValidOps } from '../core/types'
import type { PivotTable } from './pivotEngine'

/**
 * EUROPIVOT — Derived Metrics Engine (T06b). SDD C13, RF-27/28/29/32/33.
 *
 * Todo cálculo derivado pasa por aquí y queda GOBERNADO por los
 * `validOps` de la ficha del dataset (T05b): una operación desactivada
 * NO se calcula en silencio ni se sustituye por otra — se devuelve
 * `ok: false` con el motivo que verá el usuario. El motor no conoce
 * datasets ni unidades concretas (C2): recibe las reglas.
 *
 * Honestidad de etiquetas (RF-28): la media que calcula EUROPIVOT se
 * llama siempre «Media simple calculada por EUROPIVOT (sin ponderar) —
 * no es el agregado oficial». La fila/columna de la UE que viene de
 * Eurostat se etiqueta «Agregado oficial de la UE».
 */

export const LABEL_SIMPLE_MEAN =
  'Media simple calculada por EUROPIVOT (sin ponderar) — no es el agregado oficial'
export const LABEL_OFFICIAL_EU = 'Agregado oficial de la UE'
export const LABEL_SUM = 'Suma calculada por EUROPIVOT'
export const LABEL_MEDIAN = 'Mediana calculada por EUROPIVOT (sin ponderar)'

export type Computed<T> = { ok: true; value: T } | { ok: false; reason: string }

const notAllowed = (ops: ValidOps, fallback: string): { ok: false; reason: string } => ({
  ok: false,
  reason: ops.disabledReason ?? fallback,
})

export type AggregateOp = 'sum' | 'mean' | 'median' | 'min' | 'max'

export interface AggregateResult {
  value: number | null
  /** Cuántos valores reales entraron en el cálculo. */
  n: number
  /** Cuántas celdas ausentes se excluyeron (se dicen, no se esconden). */
  excludedMissing: number
  /** Etiqueta obligatoria al mostrar este número (RF-28). */
  label: string
}

const AGGREGATE_LABELS: Record<AggregateOp, string> = {
  sum: LABEL_SUM,
  mean: LABEL_SIMPLE_MEAN,
  median: LABEL_MEDIAN,
  min: 'Mínimo de la selección',
  max: 'Máximo de la selección',
}

function opAllowed(ops: ValidOps, op: AggregateOp): boolean {
  switch (op) {
    case 'sum':
      return ops.sum
    case 'mean':
      return ops.mean
    case 'median':
      return ops.median
    case 'min':
    case 'max':
      return ops.minMax
  }
}

/**
 * Agrega valores de celdas (las ausentes llegan como null y se excluyen
 * contándolas). Si la operación está desactivada en la ficha, devuelve
 * el motivo en vez del número.
 */
export function aggregate(
  values: readonly (number | null)[],
  op: AggregateOp,
  ops: ValidOps,
): Computed<AggregateResult> {
  if (!opAllowed(ops, op)) {
    return notAllowed(ops, `La operación «${op}» no está permitida para esta unidad.`)
  }
  const present = values.filter((v): v is number => v !== null)
  const excludedMissing = values.length - present.length
  if (present.length === 0) {
    return {
      ok: true,
      value: { value: null, n: 0, excludedMissing, label: AGGREGATE_LABELS[op] },
    }
  }
  let value: number
  switch (op) {
    case 'sum':
      value = present.reduce((a, b) => a + b, 0)
      break
    case 'mean':
      value = present.reduce((a, b) => a + b, 0) / present.length
      break
    case 'median': {
      const sorted = [...present].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      break
    }
    case 'min':
      value = Math.min(...present)
      break
    case 'max':
      value = Math.max(...present)
      break
  }
  return {
    ok: true,
    value: { value, n: present.length, excludedMissing, label: AGGREGATE_LABELS[op] },
  }
}

export interface SeriesPoint {
  period: string
  value: number | null
}

export interface DeltaStep {
  from: string
  to: string
  /** Variación relativa en % — solo si validOps.deltaPct. */
  deltaPct?: number
  /** Variación en puntos porcentuales — solo si validOps.deltaPp. */
  deltaPp?: number
}

/**
 * Variaciones paso a paso de una serie. RF-32: Δpp y Δ% son campos
 * DISTINTOS y nunca se mezclan: de 5 % a 6 % el resultado es
 * deltaPp = 1 y deltaPct = 20, cada uno con su nombre.
 * Pasos con un extremo ausente se omiten (no se inventa el salto).
 */
export function deltas(series: readonly SeriesPoint[], ops: ValidOps): DeltaStep[] {
  const steps: DeltaStep[] = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]
    const curr = series[i]
    if (prev.value === null || curr.value === null) continue
    const step: DeltaStep = { from: prev.period, to: curr.period }
    if (ops.deltaPp) step.deltaPp = curr.value - prev.value
    if (ops.deltaPct && prev.value !== 0) {
      step.deltaPct = ((curr.value - prev.value) / Math.abs(prev.value)) * 100
    }
    steps.push(step)
  }
  return steps
}

/**
 * CAGR (tasa anual compuesta) entre el primer y el último valor de una
 * serie, con `periodsPerYear` pasos por año (1 anual, 4 trimestral,
 * 12 mensual). Base cero/negativa o extremos ausentes → no se calcula
 * y se dice por qué.
 */
export function cagr(
  series: readonly SeriesPoint[],
  ops: ValidOps,
  periodsPerYear = 1,
): Computed<number> {
  if (!ops.cagr) {
    return notAllowed(ops, 'La tasa de crecimiento anual compuesta no se aplica a esta unidad.')
  }
  const present = series.filter((p) => p.value !== null)
  if (present.length < 2) {
    return { ok: false, reason: 'Se necesitan al menos dos periodos con dato para el CAGR.' }
  }
  const first = present[0]
  const last = present[present.length - 1]
  if (first.value === null || last.value === null || first.value <= 0) {
    return {
      ok: false,
      reason: 'El CAGR no se calcula cuando el valor inicial es cero, negativo o no tiene dato.',
    }
  }
  const years = (present.length - 1) / periodsPerYear
  // Ojo: los pasos cuentan intervalos entre observaciones presentes.
  const value = (Math.pow(last.value / first.value, 1 / years) - 1) * 100
  return { ok: true, value }
}

/**
 * Índice base 100 con un periodo base elegido. RF-32: si el periodo
 * base no tiene dato o es cero, NO se calcula y la explicación sugiere
 * elegir otro periodo base.
 */
export function index100(
  series: readonly SeriesPoint[],
  basePeriod: string,
  ops: ValidOps,
): Computed<SeriesPoint[]> {
  if (!ops.index100) {
    return notAllowed(ops, 'El índice base 100 no está permitido para esta unidad.')
  }
  const base = series.find((p) => p.period === basePeriod)
  if (!base || base.value === null || base.value === 0) {
    return {
      ok: false,
      reason: `El periodo base ${basePeriod} no tiene dato o es cero: elige otro periodo base.`,
    }
  }
  const baseValue = base.value
  return {
    ok: true,
    value: series.map((p) => ({
      period: p.period,
      value: p.value === null ? null : (p.value / baseValue) * 100,
    })),
  }
}

export interface RankingEntry {
  key: string
  value: number
  rank: number
}

export interface RankingResult {
  period: string
  ranked: RankingEntry[]
  /** Claves sin dato en el periodo común — se nombran, no desaparecen (RF-32/33). */
  excluded: string[]
}

/**
 * Ranking en un PERIODO COMÚN (RF-33): la tabla debe ser geo × tiempo
 * (o tiempo × geo; se detecta por dónde está el periodo). Quien no
 * tiene dato en ese periodo queda en `excluded`, a la vista.
 */
export function rankingAtPeriod(
  table: PivotTable,
  period: string,
  ops: ValidOps,
): Computed<RankingResult> {
  if (!ops.ranking) {
    return notAllowed(ops, 'El ranking no está permitido para esta unidad.')
  }
  const timeOnRows = table.rowDims.includes('time')
  const timeOnCols = table.colDims.includes('time')
  if (!timeOnRows && !timeOnCols) {
    return { ok: false, reason: 'La tabla no tiene dimensión temporal: no hay periodo común.' }
  }
  const entries: { key: string; value: number | null }[] = []
  if (timeOnCols) {
    const j = table.colKeys.findIndex((k) => k[table.colDims.indexOf('time')] === period)
    if (j < 0) return { ok: false, reason: `El periodo ${period} no está en la tabla.` }
    table.rowKeys.forEach((rk, i) => {
      entries.push({ key: rk.join(' · '), value: table.cells[i][j].value })
    })
  } else {
    const i = table.rowKeys.findIndex((k) => k[table.rowDims.indexOf('time')] === period)
    if (i < 0) return { ok: false, reason: `El periodo ${period} no está en la tabla.` }
    table.colKeys.forEach((ck, j) => {
      entries.push({ key: ck.join(' · '), value: table.cells[i][j].value })
    })
  }
  const withData = entries
    .filter((e): e is { key: string; value: number } => e.value !== null)
    .sort((a, b) => b.value - a.value)
  return {
    ok: true,
    value: {
      period,
      ranked: withData.map((e, idx) => ({ key: e.key, value: e.value, rank: idx + 1 })),
      excluded: entries.filter((e) => e.value === null).map((e) => e.key),
    },
  }
}

/**
 * Fila de referencia oficial: extrae de la tabla la fila (o columna)
 * del agregado UE si está — sus valores son datos de Eurostat, no
 * cálculos nuestros, y se etiquetan como agregado oficial (RF-26/28).
 */
export function officialReference(
  table: PivotTable,
  refCode = 'EU27_2020',
): { key: string; label: string; values: (number | null)[] } | null {
  const onRows = table.rowDims.includes('geo')
  if (onRows) {
    const geoPos = table.rowDims.indexOf('geo')
    const i = table.rowKeys.findIndex((k) => k[geoPos] === refCode)
    if (i < 0) return null
    return {
      key: refCode,
      label: LABEL_OFFICIAL_EU,
      values: table.cells[i].map((c) => c.value),
    }
  }
  const geoPos = table.colDims.indexOf('geo')
  if (geoPos < 0) return null
  const j = table.colKeys.findIndex((k) => k[geoPos] === refCode)
  if (j < 0) return null
  return {
    key: refCode,
    label: LABEL_OFFICIAL_EU,
    values: table.cells.map((row) => row[j].value),
  }
}

/** Formato de número en español: 1.690.012 / 5,2. */
export function fmtEs(value: number, decimals = 1): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

export interface SummaryInput {
  /** Qué se describe, p. ej. «La tasa de paro de España». */
  subject: string
  /** Unidad en palabras, p. ej. «% de la población activa». */
  unitLabel: string
  series: SeriesPoint[]
  ops: ValidOps
  /** Referencia oficial opcional para el mismo último periodo. */
  reference?: { value: number; period: string }
  /** Si se muestra la media simple del panel, entra rotulada (RF-28). */
  panelMean?: { value: number; period: string }
}

/**
 * Frase-resumen del panel (RF-29): plantillas deterministas, sin LLM,
 * sin causalidad, sin adjetivos de juico. Dice el valor, el periodo,
 * la variación (pp y/o % según validOps, nunca mezcladas) y, si están,
 * la referencia oficial y la media simple — cada una con su etiqueta.
 */
export function summarySentence(input: SummaryInput): string | null {
  const present = input.series.filter((p) => p.value !== null)
  if (present.length === 0) return null
  const first = present[0]
  const last = present[present.length - 1]
  let sentence = `${input.subject} fue de ${fmtEs(last.value!)} ${input.unitLabel} en ${last.period}`
  if (present.length > 1 && first.period !== last.period) {
    const parts: string[] = []
    if (input.ops.deltaPp) {
      const pp = last.value! - first.value!
      parts.push(
        `${pp >= 0 ? '+' : ''}${fmtEs(pp)} puntos porcentuales desde ${first.period}`,
      )
    }
    if (input.ops.deltaPct && first.value !== 0) {
      const pct = ((last.value! - first.value!) / Math.abs(first.value!)) * 100
      parts.push(`${pct >= 0 ? '+' : ''}${fmtEs(pct)} % en el periodo`)
    }
    if (parts.length > 0) sentence += ` (${parts.join('; ')})`
  }
  sentence += '.'
  if (input.reference && input.reference.period === last.period) {
    sentence += ` El ${LABEL_OFFICIAL_EU.charAt(0).toLowerCase()}${LABEL_OFFICIAL_EU.slice(1)} fue de ${fmtEs(input.reference.value)} ${input.unitLabel} en el mismo periodo.`
  }
  if (input.panelMean && input.panelMean.period === last.period) {
    sentence += ` La ${LABEL_SIMPLE_MEAN.charAt(0).toLowerCase()}${LABEL_SIMPLE_MEAN.slice(1).split(' — ')[0]} de los países seleccionados fue de ${fmtEs(input.panelMean.value)} ${input.unitLabel}.`
  }
  return sentence
}
