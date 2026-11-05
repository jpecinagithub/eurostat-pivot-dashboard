/**
 * EUROPIVOT — Tipos núcleo (SDD §4.2). Fuente de verdad: SDD-MASTER.md.
 * Ningún literal de dataset vive aquí (C2): estos tipos son genéricos.
 */

export type DimId = string
export type Code = string

/** Cómo se pide el tiempo a la Statistics API: un solo modo por consulta (§2.2). */
export type TimeSelection =
  | { mode: 'last'; n: number }
  | { mode: 'range'; since: string; until: string }
  | { mode: 'values'; values: string[] }

export type GeoLevel = 'aggregate' | 'country' | 'nuts1' | 'nuts2' | 'nuts3' | 'city'

/**
 * Especificación completa de un panel. `filters` es lo ÚNICO que dispara una
 * nueva extracción; `rows`/`columns` solo repivotan en cliente (C4, RF-07/08).
 */
export interface PivotSpec {
  dataset: string
  /** Idioma de la petición a la API. La UI es ES; la traducción va en cliente (§2.1). */
  lang: 'EN' | 'FR' | 'DE'
  filters: Record<DimId, Code[]>
  time: TimeSelection
  /** Excluyente con filters.geo (error 150 si van juntos, §2.2). */
  geoLevel?: GeoLevel
  rows: DimId[]
  columns: DimId[]
}

export type DimRole = 'time' | 'geo' | 'metric'

export interface DatasetDimension {
  id: DimId
  label: string
  role?: DimRole
  /** Codelist SDMX de la dimensión (UNIT, GEO, NA_ITEM…) si el DSD la declara. */
  codelist?: string
  categories: { code: Code; label: string }[]
}

/** Esquema de un dataset, siempre obtenido de su DSD/content constraint (C9). */
export interface DatasetSchema {
  dataset: string
  /** Versión de la estructura (los DSD de Eurostat están versionados). */
  version: string
  dims: DatasetDimension[]
}

/** Fila de la tabla tidy intermedia obligatoria (C3). */
export type TidyRow = {
  [dim: DimId]: string
} & {
  value: number | null
  /** Flag oficial (e/p/b…) como columna propia, nunca pegado al número (C8). */
  status?: string
}

/** Operaciones con sentido para un indicador/unidad/dimensión (C13, RF-27/32). */
export interface ValidOps {
  sum: boolean
  mean: boolean
  median: boolean
  minMax: boolean
  deltaPct: boolean
  deltaPp: boolean
  cagr: boolean
  index100: boolean
  ranking: boolean
  /** Frase que ve el usuario cuando una operación está desactivada. */
  disabledReason?: string
}

/** Ficha mínima de un dataset curado (§3.13, C14). Se rellena en T05b. */
export interface DatasetCard {
  code: string
  titleEs: string
  status: 'activo' | 'historico'
  successor?: string
  lastPeriod?: string
  defaultUnit?: string
  defaultIndicator?: string
  validOps: Partial<Record<string, ValidOps>>
  /** Qué es el agregado oficial según la metodología ESMS (RF-28). */
  aggregateNature?: string
  exampleQuery?: string
  verifiedAt?: string
  /** Frecuencia del dataset según su constraint (A/Q/M). */
  freq?: string
  /** Dimensiones y roles según DSD/content constraint (§3.13). */
  dims?: { id: DimId; role?: DimRole }[]
}

export type VizType = 'table' | 'line' | 'bar' | 'map' | 'ranking' | 'kpi'

export interface Panel {
  id: string
  title: string
  viz: VizType
  spec: PivotSpec
  /** Posición en la rejilla del dashboard (RF-18). */
  rect: { x: number; y: number; w: number; h: number }
}

/** Dashboard = colección de paneles independientes, cada uno con su dataset (RF-17). */
export interface Dashboard {
  id: string
  name: string
  panels: Panel[]
  savedAt?: string
}
