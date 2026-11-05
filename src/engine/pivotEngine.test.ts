import { describe, expect, it } from 'vitest'
import { parseJsonStat } from '../services/jsonstatParser'
import demoFixture from '../services/__fixtures__/demo_r_d3dens.country.2020-2024.json'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'
import { PivotAmbiguityError, pivot, subsetRows } from './pivotEngine'

const demo = parseJsonStat(demoFixture, 'demo_r_d3dens')
const nama = parseJsonStat(namaFixture, 'nama_10_gdp')

function cellOf(
  table: ReturnType<typeof pivot>,
  rowKey: string[],
  colKey: string[],
): { value: number | null; status?: string } | undefined {
  const i = table.rowKeys.findIndex((k) => k.join() === rowKey.join())
  const j = table.colKeys.findIndex((k) => k.join() === colKey.join())
  if (i < 0 || j < 0) return undefined
  return table.cells[i][j]
}

describe('Pivot Engine — golden sobre fixtures reales (T06)', () => {
  const table = pivot(demo.rows, demo.schema, { rows: ['geo'], columns: ['time'] })

  it('geo × tiempo: 36 filas (RS no tiene datos) y 5 columnas cronológicas', () => {
    expect(table.rowKeys).toHaveLength(36)
    expect(table.rowKeys.map((k) => k[0])).not.toContain('RS')
    expect(table.colKeys.map((k) => k[0])).toEqual(['2020', '2021', '2022', '2023', '2024'])
  })

  it('celdas doradas: densidad de España, verificadas contra la fixture', () => {
    expect(cellOf(table, ['ES'], ['2020'])?.value).toBe(93.8)
    expect(cellOf(table, ['ES'], ['2021'])?.value).toBe(94.2)
    expect(cellOf(table, ['ES'], ['2022'])?.value).toBe(95.1)
    expect(cellOf(table, ['ES'], ['2023'])?.value).toBe(96.2)
    expect(cellOf(table, ['ES'], ['2024'])?.value).toBe(97.2)
  })

  it('ausencia = null, nunca 0: Reino Unido solo tiene 2020 (275,3)', () => {
    expect(cellOf(table, ['UK'], ['2020'])?.value).toBe(275.3)
    for (const year of ['2021', '2022', '2023', '2024']) {
      expect(cellOf(table, ['UK'], [year])?.value).toBeNull()
    }
    const allValues = table.cells.flat().map((c) => c.value)
    expect(allValues.filter((v) => v !== null)).toHaveLength(174)
  })

  it('conservación: la suma de celdas no nulas == suma de las filas tidy', () => {
    const fromTable = table.cells
      .flat()
      .reduce((acc, c) => acc + (c.value ?? 0), 0)
    const fromRows = demo.rows.reduce((acc, r) => acc + (r.value ?? 0), 0)
    expect(fromTable).toBeCloseTo(fromRows, 6)
  })

  it('el status viaja con la celda (nama: ES 2025 provisional)', () => {
    const t = pivot(nama.rows, nama.schema, { rows: ['geo'], columns: ['time'] })
    expect(cellOf(t, ['ES'], ['2025'])).toEqual({ value: 1690012, status: 'p' })
    expect(cellOf(t, ['ES'], ['2023'])?.status).toBeUndefined()
  })
})

describe('Pivot Engine — repivotar es recalcular, no re-consultar (C4/RF-08)', () => {
  it('transponer geo×tiempo → tiempo×geo conserva celdas y valores', () => {
    const a = pivot(demo.rows, demo.schema, { rows: ['geo'], columns: ['time'] })
    const b = pivot(demo.rows, demo.schema, { rows: ['time'], columns: ['geo'] })
    expect(b.rowKeys).toHaveLength(5)
    expect(b.colKeys).toHaveLength(36)
    expect(cellOf(b, ['2024'], ['ES'])?.value).toBe(cellOf(a, ['ES'], ['2024'])?.value)
    const nonNull = (t: typeof a) => t.cells.flat().filter((c) => c.value !== null).length
    expect(nonNull(b)).toBe(nonNull(a))
  })

  it('subsetRows: ocultar países de lo ya descargado no necesita más datos', () => {
    const onlyEsFr = subsetRows(demo.rows, { geo: ['ES', 'FR'] })
    expect(onlyEsFr).toHaveLength(10)
    expect(new Set(onlyEsFr.map((r) => r['geo']))).toEqual(new Set(['ES', 'FR']))
    const t = pivot(onlyEsFr, demo.schema, { rows: ['geo'], columns: ['time'] })
    expect(t.rowKeys.map((k) => k[0])).toEqual(['ES', 'FR'])
  })

  it('una dimensión no colocada con varios valores = ambigüedad explícita', () => {
    // nama trae unit y na_item fijos, pero si pedimos solo geo×time sin
    // fijarlos... en la fixture ya vienen únicos; lo forzamos con demo:
    // demo tiene freq y unit constantes → no lanza; nama con 2 unidades sí.
    const twoUnits = [
      ...nama.rows,
      ...nama.rows.map((r) => ({ ...r, unit: 'CLV20_MEUR', value: 1 })),
    ]
    expect(() =>
      pivot(twoUnits, nama.schema, { rows: ['geo'], columns: ['time'] }),
    ).toThrowError(PivotAmbiguityError)
    expect(() =>
      pivot(twoUnits, nama.schema, { rows: ['geo'], columns: ['time'] }),
    ).toThrowError(/unit/)
  })
})
