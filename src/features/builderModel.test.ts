// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CURATED_PACK } from '../config/curatedPack'
import { buildSchema } from '../services/schemaService'
import dsdXml from '../services/__fixtures__/nama_10_gdp.datastructure.xml?raw'
import constraintXml from '../services/__fixtures__/nama_10_gdp.contentconstraint.xml?raw'
import {
  applyGeoPreset,
  budgetFor,
  initialBuilderState,
  toPivotSpec,
} from './builderModel'

const schema = buildSchema('nama_10_gdp', dsdXml, constraintXml)
const card = CURATED_PACK.find((c) => c.code === 'nama_10_gdp')

describe('Builder model (T08)', () => {
  it('la selección inicial usa los valores de la FICHA, no el primer código que pasa', () => {
    const state = initialBuilderState(schema, card)
    expect(state.selections['unit']).toEqual(['CP_MEUR'])
    expect(state.selections['na_item']).toEqual(['B1GQ'])
    expect(state.selections['geo']).toEqual(['EU27_2020'])
    expect(state.time).toEqual({ mode: 'last', n: 10 })
    expect(state.rows).toEqual(['geo'])
    expect(state.columns).toEqual(['time'])
  })

  it('preset «España y vecinos» aplica solo países que el dataset ofrece', () => {
    const initial = initialBuilderState(schema, card)
    const { state, applied } = applyGeoPreset(initial, schema, 'spain-neighbors')
    expect(applied).toEqual(expect.arrayContaining(['ES', 'FR', 'PT', 'IT']))
    expect(state.selections['geo']).toEqual(applied)
    expect(state.geoLevel).toBeUndefined()
  })

  it('preset UE-27 trae 27 países y el agregado UE no se cuela como país', () => {
    const { applied } = applyGeoPreset(initialBuilderState(schema), schema, 'eu27')
    expect(applied).toHaveLength(27)
    expect(applied).not.toContain('EU27_2020')
  })

  it('preset «Todos los países» = geoLevel=country, sin lista de países (RF-25)', () => {
    const { state, applied } = applyGeoPreset(
      initialBuilderState(schema),
      schema,
      'all-countries',
    )
    expect(state.geoLevel).toBe('country')
    expect(state.selections['geo']).toEqual([])
    expect(applied).toEqual(['geoLevel=country'])
    const spec = toPivotSpec('nama_10_gdp', state)
    expect(spec.geoLevel).toBe('country')
    expect(spec.filters['geo']).toBeUndefined()
  })

  it('la estimación C5 bloquea la spec abierta y deja pasar la inicial', () => {
    const initial = initialBuilderState(schema, card)
    expect(budgetFor('nama_10_gdp', initial, schema).cells).toBe(10)
    const wideOpen = {
      ...initial,
      selections: {},
      time: { mode: 'values', values: schema.dims.find((d) => d.id === 'time')!.categories.map((c) => c.code) } as const,
    }
    const budget = budgetFor('nama_10_gdp', wideOpen, schema)
    expect(budget.cells).toBe(2927808)
    expect(budget.overBudget).toBe(true)
  })
})
