import { GEO_PRESETS, type GeoPresetId } from '../config/geoPresets'
import type { DatasetCard, DatasetSchema, DimId, PivotSpec, TimeSelection } from '../core/types'
import { estimateCells, safeInitialSelection, type CellBudget } from '../services/schemaService'

/**
 * EUROPIVOT — Modelo del constructor (T08). Estado editable del usuario
 * → PivotSpec válida. Sin red y sin React: la UI pinta este modelo.
 *
 * Decisiones que viven aquí y no en la UI:
 *  - La selección inicial es la segura de T05 (RF-06), MEJORADA con los
 *    valores por defecto de la ficha del pack cuando el dataset es del
 *    pack (la unidad titular no es «la primera que pase»).
 *  - Los presets geo se intersectan con las categorías reales del
 *    constraint: ningún preset promete países que el dataset no tiene.
 *  - Ninguna spec sale de aquí sin su estimación de celdas (C5).
 */

export interface BuilderState {
  selections: Record<DimId, string[]>
  time: TimeSelection
  rows: DimId[]
  columns: DimId[]
  geoLevel?: 'country'
}

export function initialBuilderState(
  schema: DatasetSchema,
  card?: DatasetCard,
): BuilderState {
  const spec = safeInitialSelection(schema)
  const selections: Record<DimId, string[]> = { ...spec.filters }

  if (card) {
    // Unidad por defecto de la ficha → dimensión unit.
    if (card.defaultUnit) {
      const unitDim = schema.dims.find((d) => d.id === 'unit')
      if (unitDim?.categories.some((c) => c.code === card.defaultUnit)) {
        selections['unit'] = [card.defaultUnit]
      }
    }
    // Indicador por defecto → la dimensión (la que sea) que lo contiene.
    if (card.defaultIndicator) {
      for (const dim of schema.dims) {
        if (dim.id === 'time' || dim.id === 'geo' || dim.id === 'freq' || dim.id === 'unit') {
          continue
        }
        if (dim.categories.some((c) => c.code === card.defaultIndicator)) {
          selections[dim.id] = [card.defaultIndicator]
          break
        }
      }
    }
    // Defaults por dimensión de la ficha (size_emp=GE10, sector=S13…):
    // solo si el código existe de verdad en el constraint (C9/C14).
    if (card.defaults) {
      for (const [dimId, code] of Object.entries(card.defaults)) {
        const dim = schema.dims.find((d) => d.id === dimId)
        if (dim?.categories.some((c) => c.code === code)) {
          selections[dimId] = [code]
        }
      }
    }
  }

  return {
    selections,
    time: spec.time,
    rows: spec.rows,
    columns: spec.columns,
  }
}

/**
 * Dimensiones con VARIOS valores seleccionados que no están ni en
 * filas ni en columnas. Esa configuración es impintable: la respuesta
 * traería datos mezclables en las mismas celdas y el motor pivot la
 * rechaza (PivotAmbiguityError). El constructor la detecta ANTES de
 * aplicar — es la causa del «constructor que se queda vacío» que
 * reportó Jon: aplicar funcionaba, y el panel reventaba al pintar.
 */
export function unplacedMultiSelections(state: BuilderState): DimId[] {
  const placed = new Set<string>([...state.rows, ...state.columns])
  return Object.entries(state.selections)
    .filter(([dim, codes]) => codes.length > 1 && !placed.has(dim))
    .map(([dim]) => dim as DimId)
}

export function toggleValue(
  state: BuilderState,
  dim: DimId,
  code: string,
): BuilderState {
  const current = state.selections[dim] ?? []
  const next = current.includes(code)
    ? current.filter((c) => c !== code)
    : [...current, code]
  return { ...state, selections: { ...state.selections, [dim]: next } }
}

export function setAllValues(
  state: BuilderState,
  schema: DatasetSchema,
  dim: DimId,
  all: boolean,
): BuilderState {
  const dimDef = schema.dims.find((d) => d.id === dim)
  if (!dimDef) return state
  return {
    ...state,
    selections: {
      ...state.selections,
      [dim]: all ? dimDef.categories.map((c) => c.code) : [],
    },
  }
}

/**
 * Aplica un preset geográfico (RF-25). Devuelve el estado nuevo y los
 * códigos efectivamente aplicados (la intersección honesta con lo que
 * el dataset ofrece). «all-countries» activa geoLevel y limpia geo.
 */
export function applyGeoPreset(
  state: BuilderState,
  schema: DatasetSchema,
  preset: GeoPresetId,
): { state: BuilderState; applied: string[] } {
  const presetDef = GEO_PRESETS.find((p) => p.id === preset)
  const geoDim = schema.dims.find((d) => d.id === 'geo')
  if (!presetDef || !geoDim) return { state, applied: [] }

  if (presetDef.codes === 'geoLevel') {
    return {
      state: {
        ...state,
        geoLevel: 'country',
        selections: { ...state.selections, geo: [] },
      },
      applied: ['geoLevel=country'],
    }
  }
  const available = new Set(geoDim.categories.map((c) => c.code))
  const applied = presetDef.codes.filter((c) => available.has(c))
  return {
    state: {
      ...state,
      geoLevel: undefined,
      selections: { ...state.selections, geo: applied },
    },
    applied,
  }
}

export function toPivotSpec(dataset: string, state: BuilderState): PivotSpec {
  const filters: Record<DimId, string[]> = {}
  for (const [dim, codes] of Object.entries(state.selections)) {
    if (codes.length > 0) filters[dim] = [...codes]
  }
  const spec: PivotSpec = {
    dataset,
    lang: 'EN',
    filters,
    time: state.time,
    rows: state.rows,
    columns: state.columns,
  }
  if (state.geoLevel) spec.geoLevel = state.geoLevel
  return spec
}

export function budgetFor(
  dataset: string,
  state: BuilderState,
  schema: DatasetSchema,
): CellBudget {
  return estimateCells(toPivotSpec(dataset, state), schema)
}
