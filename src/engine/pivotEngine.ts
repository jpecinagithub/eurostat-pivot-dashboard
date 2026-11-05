import type { DatasetSchema, DimId, PivotSpec, TidyRow } from '../core/types'

/**
 * EUROPIVOT — Pivot Engine (T06). SDD C3/C4, RF-07/08.
 *
 * Función PURA: filas tidy + esquema + especificación → tabla pivot.
 * No hace red, no conoce Eurostat, no muta sus entradas. Repivotar
 * (cambiar filas/columnas) es recalcular sobre los mismos datos,
 * nunca re-consultar (C4).
 *
 * Reglas que este motor garantiza:
 *  - Celda sin observación = `null`, JAMÁS 0 (la ausencia ≠ 0 de C3
 *    llega hasta la vista).
 *  - El orden de filas/columnas es el orden de categorías del esquema
 *    (para `time`, el orden del constraint = cronológico).
 *  - Una dimensión que no está en filas ni en columnas debe tener un
 *    único valor en los datos; si tiene varios, la tabla sería ambigua
 *    y el motor lo dice (PivotAmbiguityError) en vez de mezclar datos
 *    de dos unidades o dos indicadores en la misma celda.
 */

export class PivotAmbiguityError extends Error {
  readonly dim: DimId
  readonly values: string[]
  constructor(dim: DimId, values: string[]) {
    super(
      `La dimensión «${dim}» no está en filas ni en columnas y tiene ${values.length} valores en los datos (${values.join(', ')}). Colócala en filas/columnas o filtra a un solo valor.`,
    )
    this.name = 'PivotAmbiguityError'
    this.dim = dim
    this.values = values
  }
}

export interface PivotCell {
  value: number | null
  status?: string
}

export interface PivotTable {
  rowDims: DimId[]
  colDims: DimId[]
  /** Claves de fila: tuplas de códigos en el orden de `rowDims`. */
  rowKeys: string[][]
  colKeys: string[][]
  /** cells[i][j] ↔ rowKeys[i] × colKeys[j]. */
  cells: PivotCell[][]
}

const EMPTY_CELL: PivotCell = { value: null }

function categoryOrder(schema: DatasetSchema): Map<DimId, Map<string, number>> {
  const order = new Map<DimId, Map<string, number>>()
  for (const dim of schema.dims) {
    order.set(
      dim.id,
      new Map(dim.categories.map((c, i) => [c.code, i] as const)),
    )
  }
  return order
}

/** Compara tuplas por el orden de categorías del esquema (desempate: alfabético). */
function tupleComparator(
  dims: DimId[],
  order: Map<DimId, Map<string, number>>,
): (a: string[], b: string[]) => number {
  return (a, b) => {
    for (let i = 0; i < dims.length; i++) {
      const oa = order.get(dims[i])?.get(a[i]) ?? Number.MAX_SAFE_INTEGER
      const ob = order.get(dims[i])?.get(b[i]) ?? Number.MAX_SAFE_INTEGER
      if (oa !== ob) return oa - ob
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
    }
    return 0
  }
}

const keyOf = (tuple: string[]): string => tuple.join('\u0000')

export function pivot(
  rows: readonly TidyRow[],
  schema: DatasetSchema,
  spec: Pick<PivotSpec, 'rows' | 'columns'>,
): PivotTable {
  const rowDims = spec.rows
  const colDims = spec.columns
  const placed = new Set([...rowDims, ...colDims])

  // Dimensiones no colocadas: deben ser constantes en los datos.
  const allDims = schema.dims.map((d) => d.id)
  for (const dim of allDims) {
    if (placed.has(dim)) continue
    const distinct = new Set(rows.map((r) => r[dim]))
    if (distinct.size > 1) {
      throw new PivotAmbiguityError(dim, [...distinct].sort())
    }
  }

  const order = categoryOrder(schema)
  const rowKeySet = new Map<string, string[]>()
  const colKeySet = new Map<string, string[]>()
  const cellMap = new Map<string, PivotCell>()

  for (const row of rows) {
    const rk = rowDims.map((d) => row[d])
    const ck = colDims.map((d) => row[d])
    rowKeySet.set(keyOf(rk), rk)
    colKeySet.set(keyOf(ck), ck)
    const cellKey = `${keyOf(rk)}\u0001${keyOf(ck)}`
    if (cellMap.has(cellKey)) {
      // Dos observaciones para la misma celda: el tidy venía duplicado.
      throw new PivotAmbiguityError(
        [...rowDims, ...colDims].join('+') || '(sin dimensiones)',
        [`celda duplicada en ${rk.join('/')} × ${ck.join('/')}`],
      )
    }
    const cell: PivotCell = { value: row.value }
    if (row.status !== undefined) cell.status = row.status
    cellMap.set(cellKey, cell)
  }

  const rowKeys = [...rowKeySet.values()].sort(tupleComparator(rowDims, order))
  const colKeys = [...colKeySet.values()].sort(tupleComparator(colDims, order))
  const cells: PivotCell[][] = rowKeys.map((rk) =>
    colKeys.map((ck) => cellMap.get(`${keyOf(rk)}\u0001${keyOf(ck)}`) ?? EMPTY_CELL),
  )

  return { rowDims, colDims, rowKeys, colKeys, cells }
}

/**
 * Subconjunto por filtros sobre las filas ya descargadas (RF-08):
 * ocultar valores de una selección mayor NO necesita red; esta función
 * es la prueba operativa — trabaja solo sobre memoria.
 */
export function subsetRows(
  rows: readonly TidyRow[],
  filters: Partial<Record<DimId, readonly string[]>>,
): TidyRow[] {
  const active = Object.entries(filters).filter(([, v]) => v && v.length > 0)
  if (active.length === 0) return [...rows]
  return rows.filter((row) =>
    active.every(([dim, values]) => values!.includes(row[dim])),
  )
}
