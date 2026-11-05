import JSONstat from 'jsonstat-toolkit'
import type { DatasetDimension, DatasetSchema, TidyRow } from '../core/types'

/**
 * EUROPIVOT — Parser JSON-stat 2.0 → tabla tidy (T03). SDD §2.3, RF-04, C3/C8.
 *
 * La estructura se valida y se navega con jsonstat-toolkit; el aplanado
 * usa la aritmética de strides del SDD (row-major: la última dimensión
 * varía más rápido) sobre los mapas dispersos `value`/`status` tal como
 * llegan, para no perder ni una observación ni una bandera:
 *
 *  - Ausencia ≠ 0: una celda sin entrada en `value` NO genera fila.
 *  - `status` viaja como columna propia (C8); sus textos salen de
 *    `extension.status.label` de la propia respuesta, nunca de una
 *    tabla fija (Eurostat dividió banderas en Obs/Conf en enero 2025).
 *  - OBS_COUNT de las anotaciones es el total del DATASET completo,
 *    no de la respuesta filtrada: se expone como `obsCountTotal`
 *    y nunca se usa como conteo de filas de una extracción.
 */

export class JsonStatParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonStatParseError'
  }
}

export interface JsonStatMeta {
  label?: string
  source?: string
  /** Campo `updated` de la respuesta (frescura honesta, C10). */
  updated?: string
  /** OBS_COUNT: observaciones del dataset COMPLETO, no de esta extracción. */
  obsCountTotal?: number
  /** Textos oficiales de las banderas: código → etiqueta (de la respuesta). */
  statusLabels: Record<string, string>
}

export interface ParsedDataset {
  meta: JsonStatMeta
  schema: DatasetSchema
  rows: TidyRow[]
  /** Celdas del cubo devuelto (producto de `size`). */
  totalCells: number
  /** Celdas con observación (== rows.length). */
  cellsWithValue: number
}

// Vista tipada mínima del documento JSON-stat 2.0 crudo.
interface RawJsonStat {
  version?: string
  class?: string
  label?: string
  source?: string
  updated?: string
  id?: string[]
  size?: number[]
  role?: Record<string, string[] | undefined>
  dimension?: Record<
    string,
    {
      label?: string
      category?: {
        index?: Record<string, number>
        label?: Record<string, string>
      }
    }
  >
  value?: Record<string, number> | (number | null)[]
  status?: Record<string, string> | (string | null)[]
  extension?: {
    annotation?: { type?: string; title?: string }[]
    status?: { label?: Record<string, string> }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Categorías de una dimensión ordenadas por su posición (inverso de `index`). */
function orderedCategories(raw: RawJsonStat, dimId: string): { code: string; label: string }[] {
  const cat = raw.dimension?.[dimId]?.category
  const index = cat?.index ?? {}
  const labels = cat?.label ?? {}
  return Object.entries(index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => ({ code, label: labels[code] ?? code }))
}

export function parseJsonStat(input: unknown, datasetCode = ''): ParsedDataset {
  if (!isRecord(input)) {
    throw new JsonStatParseError('La respuesta de Eurostat no es un objeto JSON-stat.')
  }
  const raw = input as RawJsonStat
  if (raw.class !== 'dataset' || !Array.isArray(raw.id) || !Array.isArray(raw.size)) {
    throw new JsonStatParseError(
      'La respuesta no es un dataset JSON-stat 2.0 (faltan class/id/size).',
    )
  }

  // Validación estructural con jsonstat-toolkit (lanza si el documento no es JSON-stat).
  let toolkitDims: Map<string, { label?: string }>
  try {
    const ds = JSONstat(input).Dataset(0)
    toolkitDims = new Map(raw.id.map((dimId) => [dimId, ds.Dimension(dimId) ?? {}]))
    if (ds.id.join() !== raw.id.join() || ds.size.join() !== raw.size.join()) {
      throw new JsonStatParseError('jsonstat-toolkit no reconoce la estructura del dataset.')
    }
  } catch (cause) {
    if (cause instanceof JsonStatParseError) throw cause
    throw new JsonStatParseError(
      `Documento JSON-stat inválido: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }

  const dimIds = raw.id
  const size = raw.size
  const totalCells = size.reduce((acc, n) => acc * n, 1)

  // Strides row-major: stride(última)=1; stride(i)=stride(i+1)·size(i+1).
  const strides = new Array<number>(dimIds.length)
  for (let i = dimIds.length - 1, acc = 1; i >= 0; i--) {
    strides[i] = acc
    acc *= size[i]
  }

  const categoriesByDim = new Map(dimIds.map((d) => [d, orderedCategories(raw, d)]))

  const dims: DatasetDimension[] = dimIds.map((dimId) => {
    const roleTime = raw.role?.['time'] ?? []
    const roleGeo = raw.role?.['geo'] ?? []
    const roleMetric = raw.role?.['metric'] ?? []
    const role: DatasetDimension['role'] =
      dimId === 'time' || roleTime.includes(dimId)
        ? 'time'
        : dimId === 'geo' || roleGeo.includes(dimId)
          ? 'geo'
          : roleMetric.includes(dimId)
            ? 'metric'
            : undefined
    return {
      id: dimId,
      label: raw.dimension?.[dimId]?.label ?? toolkitDims.get(dimId)?.label ?? dimId,
      role,
      categories: categoriesByDim.get(dimId) ?? [],
    }
  })

  const schema: DatasetSchema = {
    dataset: datasetCode,
    version: raw.version ?? '2.0',
    dims,
  }

  // Aplanado: se recorren solo las celdas CON valor (disperso o denso).
  const entries: { flat: number; value: number }[] = []
  if (Array.isArray(raw.value)) {
    raw.value.forEach((v, flat) => {
      if (typeof v === 'number') entries.push({ flat, value: v })
    })
  } else if (isRecord(raw.value)) {
    for (const [k, v] of Object.entries(raw.value)) {
      if (typeof v === 'number') entries.push({ flat: Number(k), value: v })
    }
  }
  entries.sort((a, b) => a.flat - b.flat)

  const statusAt = (flat: number): string | undefined => {
    if (Array.isArray(raw.status)) return raw.status[flat] ?? undefined
    if (isRecord(raw.status)) return raw.status[String(flat)]
    return undefined
  }

  // Contrato TidyRow (tipos núcleo): los códigos de dimensión van como
  // claves de primer nivel de la fila; `value` y `status` son las únicas
  // columnas no dimensionales.
  const rows: TidyRow[] = entries.map(({ flat, value }) => {
    const row: Record<string, string> = {}
    let remainder = flat
    for (let i = 0; i < dimIds.length; i++) {
      const pos = Math.floor(remainder / strides[i])
      remainder -= pos * strides[i]
      row[dimIds[i]] = categoriesByDim.get(dimIds[i])?.[pos]?.code ?? String(pos)
    }
    const tidy = Object.assign({}, row, { value }) as unknown as TidyRow
    const status = statusAt(flat)
    if (status !== undefined) tidy.status = status
    return tidy
  })

  const obsAnnotation = raw.extension?.annotation?.find((a) => a.type === 'OBS_COUNT')
  const obsCountTotal = obsAnnotation?.title ? Number(obsAnnotation.title) : undefined

  return {
    meta: {
      label: raw.label,
      source: raw.source,
      updated: raw.updated,
      obsCountTotal:
        obsCountTotal !== undefined && Number.isFinite(obsCountTotal) ? obsCountTotal : undefined,
      statusLabels: raw.extension?.status?.label ?? {},
    },
    schema,
    rows,
    totalCells,
    cellsWithValue: rows.length,
  }
}
