import { describe, expect, it } from 'vitest'
import type { PivotTable } from '../engine/pivotEngine'
import type { GeoJsonCollection } from '../services/geoService'
import {
  buildChoropleth,
  choroplethClasses,
  europeProjector,
  geoJsonToShapes,
  nutsLevelForCodes,
} from './mapModel'

/**
 * T10/RF-16 — el modelo del mapa: nivel por códigos, proyección
 * europea, join literal y agregados fuera del mapa.
 */

const square = (lon0: number, lat0: number, lon1: number, lat1: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [lon0, lat0],
      [lon1, lat0],
      [lon1, lat1],
      [lon0, lat1],
      [lon0, lat0],
    ],
  ],
})

const FC: GeoJsonCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { NUTS_ID: 'ES', NAME_LATN: 'España' }, geometry: square(-9, 36, 3, 44) },
    { type: 'Feature', properties: { NUTS_ID: 'FR', NAME_LATN: 'France' }, geometry: square(0, 42, 8, 51) },
    { type: 'Feature', properties: { NUTS_ID: 'DE', NAME_LATN: 'Deutschland' }, geometry: square(6, 47, 14, 55) },
    { type: 'Feature', properties: { NUTS_ID: 'PT', NAME_LATN: 'Portugal' }, geometry: square(-9, 37, -6, 44) },
  ],
}

const table = (rows: [string, number | null][]): PivotTable => ({
  rowDims: ['geo'],
  colDims: ['time'],
  rowKeys: rows.map(([g]) => [g]),
  colKeys: [['2024'], ['2025']],
  cells: rows.map(([, v]) => [
    { value: v === null ? null : v - 10 },
    { value: v },
  ]),
})

describe('nutsLevelForCodes', () => {
  it('países → 0, NUTS 2 → 2, NUTS 3 → 3; agregados no cuentan', () => {
    expect(nutsLevelForCodes(['ES', 'FR', 'EU27_2020'])).toBe(0)
    expect(nutsLevelForCodes(['ES30', 'ITC4', 'EU27_2020'])).toBe(2)
    expect(nutsLevelForCodes(['ES300', 'ITC45'])).toBe(3)
    expect(nutsLevelForCodes(['EU27_2020', 'EA21'])).toBeNull()
  })
})

describe('geoJsonToShapes + proyección europea', () => {
  it('produce paths dentro del viewBox europeo', () => {
    const proj = europeProjector()
    const shapes = geoJsonToShapes(FC, proj)
    expect(shapes.size).toBe(4)
    const es = shapes.get('ES')!
    expect(es.path.startsWith('M')).toBe(true)
    const nums = es.path.match(/-?\d+\.?\d*/g)!.map(Number)
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(-50)
      expect(nums[i]).toBeLessThanOrEqual(proj.width + 50)
      expect(nums[i + 1]).toBeGreaterThanOrEqual(-50)
      expect(nums[i + 1]).toBeLessThanOrEqual(proj.height + 50)
    }
    // España (oeste) queda a la izquierda de Alemania (este).
    const xOf = (p: string) => Number(p.slice(1).split(',')[0])
    expect(xOf(es.path)).toBeLessThan(xOf(shapes.get('DE')!.path))
  })
})

describe('choroplethClasses', () => {
  it('5 clases contiguas que cubren el rango; valor único → 1 clase', () => {
    const cs = choroplethClasses([10, 20, 30, 40, 50])
    expect(cs).toHaveLength(5)
    expect(cs[0].from).toBe(10)
    expect(cs[4].to).toBe(50)
    for (let i = 1; i < cs.length; i++) expect(cs[i].from).toBe(cs[i - 1].to)
    expect(choroplethClasses([7, 7])).toHaveLength(1)
    expect(choroplethClasses([])).toHaveLength(0)
  })
})

describe('buildChoropleth — join literal y lista aparte (RF-16)', () => {
  it('une por código, manda agregados y ZZ a la lista y cuenta sin-datos', () => {
    const shapes = geoJsonToShapes(FC, europeProjector())
    const t = table([
      ['ES', 100],
      ['FR', 200],
      ['EU27_2020', 150],
      ['ESZZ', 42],
      ['DE', null],
    ])
    const choro = buildChoropleth(t, shapes, '2025')!
    expect(choro.fills.get('ES')?.value).toBe(100)
    expect(choro.fills.get('FR')?.value).toBe(200)
    expect(choro.fills.has('DE')).toBe(false) // valor null: no entra
    expect(choro.aside).toEqual([
      { code: 'EU27_2020', value: 150 },
      { code: 'ESZZ', value: 42 },
    ])
    // PT y DE tienen geometría pero no dato con valor → sin datos = 2.
    expect(choro.noData).toBe(2)
    // La clase de FR (máx) es la última; la de ES, menor.
    expect(choro.fills.get('FR')!.classIndex).toBeGreaterThan(choro.fills.get('ES')!.classIndex)
  })

  it('devuelve null si la geografía no está sola en filas o falta el tiempo', () => {
    const shapes = geoJsonToShapes(FC, europeProjector())
    const t = table([['ES', 1]])
    expect(buildChoropleth({ ...t, rowDims: ['geo', 'sex'] }, shapes, '2025')).toBeNull()
    expect(buildChoropleth({ ...t, colDims: ['unit'] }, shapes, '2025')).toBeNull()
    expect(buildChoropleth(t, shapes, '1999')).toBeNull()
  })
})
