import { CURATED_PACK } from '../config/curatedPack'
import { categoryLabelEs, dimLabelEs } from '../config/labelsEs'

/**
 * ES Dictionary Service (T14; §2.1, RNF-01).
 *
 * La API de Eurostat no da español. Cadena de resolución de una
 * etiqueta de categoría, sin inventar nunca:
 *   1. Diccionario ES propio (dimensión → código, geo, o global).
 *   2. Nombre oficial EN (codelist SDMX o etiqueta de la respuesta
 *      JSON-stat) — descriptivo y oficial.
 *   3. El código tal cual.
 *
 * Cuando un dataset DEL PACK cae a (2) o (3), el hueco queda
 * registrado: es la lista de trabajo para ampliar el diccionario.
 * Los nombres regionales NUTS son nombres propios: su forma oficial
 * no cuenta como hueco.
 */

export type LabelSource = 'es' | 'official' | 'code'

export interface ResolvedLabel {
  label: string
  source: LabelSource
}

export interface DictionaryGap {
  dataset: string
  dim: string
  code: string
  source: Exclude<LabelSource, 'es'>
}

const PACK_CODES = new Set(CURATED_PACK.map((c) => c.code))
const gaps = new Map<string, DictionaryGap>()
const GAP_CAP = 500

const AGGREGATE_FAMILY = /^(EU|EA\d|EFTA|EEA)/

function isRegionalProperName(dim: string, code: string): boolean {
  // NUTS 1/2/3: códigos geo largos que no son agregados — nombres propios.
  return dim === 'geo' && code.length > 2 && !AGGREGATE_FAMILY.test(code)
}

export function resolveCategoryLabel(input: {
  dataset?: string
  dim: string
  code: string
  official?: string
}): ResolvedLabel {
  const { dataset, dim, code, official } = input
  const es = categoryLabelEs(dim, code)
  if (es) return { label: es, source: 'es' }
  const source: LabelSource = official ? 'official' : 'code'
  if (
    dataset &&
    PACK_CODES.has(dataset) &&
    dim !== 'time' &&
    !isRegionalProperName(dim, code) &&
    gaps.size < GAP_CAP
  ) {
    const key = `${dataset}|${dim}|${code}`
    if (!gaps.has(key)) gaps.set(key, { dataset, dim, code, source })
  }
  return { label: official ?? code, source }
}

export function resolveDimLabel(dim: string): ResolvedLabel {
  const label = dimLabelEs(dim)
  return label !== dim ? { label, source: 'es' } : { label: dim, source: 'code' }
}

/** Huecos registrados en esta sesión (solo datasets del pack). */
export function dictionaryGaps(): DictionaryGap[] {
  return [...gaps.values()]
}

export function _resetDictionaryGaps(): void {
  gaps.clear()
}
