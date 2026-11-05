// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { PivotSpec } from '../core/types'
import {
  buildSchema,
  estimateCells,
  fetchSchema,
  parseContentConstraint,
  parseDataStructure,
  safeInitialSelection,
} from './schemaService'
import dsdXml from './__fixtures__/nama_10_gdp.datastructure.xml?raw'
import ccXml from './__fixtures__/nama_10_gdp.contentconstraint.xml?raw'

const schema = buildSchema('NAMA_10_GDP', dsdXml, ccXml)

describe('Schema Service — artefactos SDMX 2.1 reales de nama_10_gdp', () => {
  it('el datastructure da dimensiones en orden y la versión del DSD', () => {
    const { version, dims } = parseDataStructure(dsdXml)
    expect(version).toBe('141.0')
    expect(dims.map((d) => d.id)).toEqual(['freq', 'unit', 'na_item', 'geo', 'time'])
    expect(dims.find((d) => d.id === 'time')?.role).toBe('time')
    expect(dims.find((d) => d.id === 'geo')?.role).toBe('geo')
  })

  it('el content constraint da las categorías DISPONIBLES por dimensión', () => {
    const available = parseContentConstraint(ccXml)
    expect(available.get('unit')).toHaveLength(32)
    expect(available.get('na_item')).toHaveLength(39)
    expect(available.get('geo')).toHaveLength(46)
    expect(available.get('time')).toHaveLength(51)
    expect(available.get('time')?.[0]).toBe('1975')
    expect(available.get('time')?.at(-1)).toBe('2025')
    expect(available.get('geo')).toContain('EU27_2020')
  })

  it('buildSchema une ambos artefactos en el DatasetSchema del núcleo', () => {
    expect(schema.dataset).toBe('nama_10_gdp')
    expect(schema.version).toBe('141.0')
    const unit = schema.dims.find((d) => d.id === 'unit')
    expect(unit?.categories).toHaveLength(32)
    expect(unit?.categories.map((c) => c.code)).toContain('CP_MEUR')
  })

  it('fetchSchema pide los dos artefactos SDMX 2.1 del dataset', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('datastructure')
        ? new Response(dsdXml, { status: 200 })
        : new Response(ccXml, { status: 200 }),
    )
    const fetched = await fetchSchema('nama_10_gdp', fetchImpl as never)
    expect(fetched.dims).toHaveLength(5)
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/sdmx/2.1/datastructure/ESTAT/NAMA_10_GDP/latest'))).toBe(true)
    expect(urls.some((u) => u.includes('/sdmx/2.1/contentconstraint/ESTAT/NAMA_10_GDP/latest'))).toBe(true)
  })
})

describe('presupuesto de celdas (C5) y selección inicial segura (RF-06)', () => {
  it('la selección inicial es mínima: 1 valor por dimensión y 10 periodos = 10 celdas', () => {
    const spec = safeInitialSelection(schema)
    expect(spec.filters['geo']).toEqual(['EU27_2020'])
    expect(Object.values(spec.filters).every((v) => v.length === 1)).toBe(true)
    expect(spec.time).toEqual({ mode: 'last', n: 10 })
    const budget = estimateCells(spec, schema)
    expect(budget.cells).toBe(10)
    expect(budget.overBudget).toBe(false)
  })

  it('sin filtros, la estimación es el cubo completo del constraint y supera el presupuesto', () => {
    const open: PivotSpec = {
      dataset: 'nama_10_gdp',
      lang: 'EN',
      filters: {},
      time: { mode: 'values', values: schema.dims.find((d) => d.id === 'time')!.categories.map((c) => c.code) },
      rows: ['geo'],
      columns: ['time'],
    }
    const budget = estimateCells(open, schema)
    expect(budget.cells).toBe(1 * 32 * 39 * 46 * 51)
    expect(budget.overBudget).toBe(true)
    expect(budget.budget).toBe(200000)
  })

  it('el modo range cuenta solo los periodos disponibles dentro del rango', () => {
    const spec = safeInitialSelection(schema)
    spec.time = { mode: 'range', since: '2020', until: '2025' }
    const budget = estimateCells(spec, schema)
    expect(budget.perDim['time']).toBe(6)
    expect(budget.cells).toBe(6)
  })

  it('geoLevel usa como cota todas las geo del esquema', () => {
    const spec = safeInitialSelection(schema)
    delete spec.filters['geo']
    spec.geoLevel = 'country'
    const budget = estimateCells(spec, schema)
    expect(budget.perDim['geo']).toBe(46)
    expect(budget.cells).toBe(46 * 10)
  })
})
