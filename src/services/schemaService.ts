import type { DatasetDimension, DatasetSchema, PivotSpec } from '../core/types'
import { LIMITS, SDMX_21_BASE } from './eurostat'

/**
 * EUROPIVOT — Schema Service (T05). SDD C9, RF-05/06, decisión T00.
 *
 * El esquema de un dataset se obtiene SOLO de sus artefactos SDMX 2.1
 * oficiales (vía demostrada en la puerta T00, con CORS *):
 *  - `datastructure/ESTAT/{CODE}/latest` → dimensiones, orden y versión.
 *  - `contentconstraint/ESTAT/{CODE}/latest` → categorías DISPONIBLES
 *    por dimensión (lo que de verdad se puede pedir de ese dataset).
 * Nunca se infiere de una respuesta de datos acotada: eso solo demuestra
 * lo que vino en esa consulta (§4.5).
 *
 * Las etiquetas de categoría llegan con label = código en esta capa; el
 * nombre legible lo aportan la respuesta JSON-stat (T03) y el diccionario
 * ES (T14). Lo que T05 garantiza es estructura y disponibilidad.
 */

export class SchemaServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaServiceError'
  }
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

/** SDMX llama al tiempo TIME_PERIOD; la Statistics API lo llama `time`. */
function normalizeDimId(sdmxId: string): string {
  return sdmxId === 'TIME_PERIOD' ? 'time' : sdmxId.toLowerCase()
}

function elementsByLocalName(root: ParentNode, localName: string): Element[] {
  return [...root.querySelectorAll('*')].filter((el) => el.localName === localName)
}

function parseXml(xml: string, artefact: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw new SchemaServiceError(`Eurostat devolvió XML inválido en ${artefact}.`)
  }
  return doc
}

/** Dimensiones y versión desde el datastructure (orden = atributo position). */
export function parseDataStructure(xml: string): { version: string; dims: DatasetDimension[] } {
  const doc = parseXml(xml, 'datastructure')
  const dsd = elementsByLocalName(doc, 'DataStructure')[0]
  const version = dsd?.getAttribute('version') ?? ''

  const found: { dim: DatasetDimension; position: number }[] = []
  for (const el of elementsByLocalName(doc, 'Dimension')) {
    const id = el.getAttribute('id')
    if (!id) continue
    const norm = normalizeDimId(id)
    found.push({
      position: Number(el.getAttribute('position') ?? 999),
      dim: {
        id: norm,
        label: norm,
        role: norm === 'geo' ? 'geo' : undefined,
        categories: [],
      },
    })
  }
  for (const el of elementsByLocalName(doc, 'TimeDimension')) {
    found.push({
      position: Number(el.getAttribute('position') ?? 999),
      dim: { id: 'time', label: 'time', role: 'time', categories: [] },
    })
  }
  found.sort((a, b) => a.position - b.position)
  return { version, dims: found.map((f) => f.dim) }
}

/** Categorías disponibles por dimensión desde el content constraint (unión de CubeRegions). */
export function parseContentConstraint(xml: string): Map<string, string[]> {
  const doc = parseXml(xml, 'contentconstraint')
  const byDim = new Map<string, Set<string>>()
  for (const kv of elementsByLocalName(doc, 'KeyValue')) {
    const rawId = kv.getAttribute('id')
    if (!rawId) continue
    const dim = normalizeDimId(rawId)
    const set = byDim.get(dim) ?? new Set<string>()
    for (const v of elementsByLocalName(kv, 'Value')) {
      const code = v.textContent?.trim()
      if (code) set.add(code)
    }
    byDim.set(dim, set)
  }
  return new Map([...byDim.entries()].map(([dim, set]) => [dim, [...set]]))
}

/** Une estructura + disponibilidad en el DatasetSchema del núcleo. */
export function buildSchema(
  dataset: string,
  dsdXml: string,
  constraintXml: string,
): DatasetSchema {
  const { version, dims } = parseDataStructure(dsdXml)
  const available = parseContentConstraint(constraintXml)
  for (const dim of dims) {
    const codes = available.get(dim.id) ?? []
    dim.categories = codes.map((code) => ({ code, label: code }))
  }
  return { dataset: dataset.toLowerCase(), version, dims }
}

export async function fetchSchema(
  dataset: string,
  fetchImpl: FetchImpl = globalThis.fetch as FetchImpl,
): Promise<DatasetSchema> {
  const code = dataset.trim().toUpperCase()
  if (!code) throw new SchemaServiceError('Dataset vacío.')
  const base = `${SDMX_21_BASE}`
  const [dsdRes, ccRes] = await Promise.all([
    fetchImpl(`${base}/datastructure/ESTAT/${code}/latest`),
    fetchImpl(`${base}/contentconstraint/ESTAT/${code}/latest`),
  ])
  if (!dsdRes.ok) {
    throw new SchemaServiceError(`datastructure de ${code}: HTTP ${dsdRes.status}`)
  }
  if (!ccRes.ok) {
    throw new SchemaServiceError(`contentconstraint de ${code}: HTTP ${ccRes.status}`)
  }
  return buildSchema(code, await dsdRes.text(), await ccRes.text())
}

// ---------------------------------------------------------------------------
// Presupuesto de celdas (C5) y selección inicial segura (RF-06)
// ---------------------------------------------------------------------------

export interface CellBudget {
  /** Celdas estimadas de la extracción (producto de cardinalidades). */
  cells: number
  /** Cardinalidad usada por dimensión (null = desconocida, sin constraint). */
  perDim: Record<string, number | null>
  overBudget: boolean
  /** Límite interactivo aplicado (LIMITS.interactiveCellBudget). */
  budget: number
}

/**
 * Estima ANTES de consultar (C5). Una dimensión sin filtro en la spec
 * significa «todas sus categorías» (semántica de la Statistics API), y
 * una dimensión sin categorías en el constraint es desconocida: la
 * estimación se marca sobre presupuesto en vez de fingir un número.
 */
export function estimateCells(spec: PivotSpec, schema: DatasetSchema): CellBudget {
  const perDim: Record<string, number | null> = {}
  let cells = 1
  let unknown = false

  for (const dim of schema.dims) {
    if (dim.id === 'time') continue
    let count: number | null
    if (dim.id === 'geo' && spec.geoLevel) {
      // geoLevel pide un nivel entero: cota superior = todas las geo del esquema.
      count = dim.categories.length || null
    } else if (spec.filters[dim.id]?.length) {
      count = spec.filters[dim.id].length
    } else {
      count = dim.categories.length || null
    }
    perDim[dim.id] = count
    if (count === null) unknown = true
    else cells *= count
  }

  const timeDim = schema.dims.find((d) => d.id === 'time')
  const availableTimes = timeDim?.categories.map((c) => c.code) ?? []
  let timeCount: number | null
  switch (spec.time.mode) {
    case 'last':
      timeCount = availableTimes.length
        ? Math.min(spec.time.n, availableTimes.length)
        : spec.time.n
      break
    case 'values':
      timeCount = spec.time.values.length
      break
    case 'range':
      timeCount = availableTimes.filter(
        (t) => t >= (spec.time as { since: string }).since && t <= (spec.time as { until: string }).until,
      ).length
      break
  }
  perDim['time'] = timeCount
  cells *= timeCount

  return {
    cells: unknown ? Number.POSITIVE_INFINITY : cells,
    perDim,
    overBudget: unknown || cells > LIMITS.interactiveCellBudget,
    budget: LIMITS.interactiveCellBudget,
  }
}

/**
 * Selección inicial segura (RF-06): un valor por dimensión, el agregado
 * UE si geo lo ofrece (referencia natural en EUROPIVOT) y los últimos
 * 10 periodos. Las fichas del pack (T05b) podrán fijar mejores valores
 * por defecto por dataset; esta es la regla genérica sin literales (C2).
 */
export function safeInitialSelection(schema: DatasetSchema): PivotSpec {
  const filters: Record<string, string[]> = {}
  for (const dim of schema.dims) {
    if (dim.id === 'time' || dim.categories.length === 0) continue
    if (dim.id === 'geo') {
      const eu = dim.categories.find((c) => c.code === 'EU27_2020')
      filters[dim.id] = [eu?.code ?? dim.categories[0].code]
    } else {
      filters[dim.id] = [dim.categories[0].code]
    }
  }
  const timeDim = schema.dims.find((d) => d.id === 'time')
  const n = Math.max(1, Math.min(10, timeDim?.categories.length ?? 10))
  const geoDim = schema.dims.find((d) => d.id === 'geo')
  const firstDim = schema.dims.find((d) => d.id !== 'time' && d.id !== 'freq')
  return {
    dataset: schema.dataset,
    lang: 'EN',
    filters,
    time: { mode: 'last', n },
    rows: [geoDim?.id ?? firstDim?.id ?? 'geo'],
    columns: ['time'],
  }
}
