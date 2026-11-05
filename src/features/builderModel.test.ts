// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { CURATED_PACK } from '../config/curatedPack'
import type { DatasetSchema } from '../core/types'
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

describe('defaults por dimensión de la ficha (defecto isoc_eb_ai)', () => {
  it('aplica size_emp=GE10 de la ficha real y no el primer valor del constraint', () => {
    const aiSchema: DatasetSchema = {
      dataset: 'isoc_eb_ai',
      version: '1',
      dims: [
        { id: 'freq', label: 'freq', categories: [{ code: 'A', label: 'A' }] },
        {
          id: 'size_emp',
          label: 'size_emp',
          categories: [
            { code: '0_1', label: '0_1' },
            { code: 'GE10', label: 'GE10' },
          ],
        },
        { id: 'unit', label: 'unit', role: 'metric', categories: [{ code: 'PC_ENT', label: 'PC_ENT' }] },
        {
          id: 'indic_is',
          label: 'indic_is',
          role: 'metric',
          categories: [{ code: 'E_AI_TANY', label: 'E_AI_TANY' }],
        },
        { id: 'geo', label: 'geo', role: 'geo', categories: [{ code: 'ES', label: 'ES' }] },
        { id: 'time', label: 'time', role: 'time', categories: [{ code: '2025', label: '2025' }] },
      ],
    }
    const aiCard = CURATED_PACK.find((c) => c.code === 'isoc_eb_ai')
    const state = initialBuilderState(aiSchema, aiCard)
    // Sin la ficha, la regla genérica dejaría «0_1» (corte casi vacío).
    expect(state.selections['size_emp']).toEqual(['GE10'])
    expect(state.selections['unit']).toEqual(['PC_ENT'])
    expect(state.selections['indic_is']).toEqual(['E_AI_TANY'])
  })

  it('un default que no existe en el constraint se ignora (C9)', () => {
    const aiCard = CURATED_PACK.find((c) => c.code === 'gov_10a_main')!
    const schemaNoS13: DatasetSchema = {
      dataset: 'gov_10a_main',
      version: '1',
      dims: [
        { id: 'sector', label: 'sector', categories: [{ code: 'S1', label: 'S1' }] },
        { id: 'geo', label: 'geo', role: 'geo', categories: [{ code: 'ES', label: 'ES' }] },
        { id: 'time', label: 'time', role: 'time', categories: [{ code: '2025', label: '2025' }] },
      ],
    }
    const state = initialBuilderState(schemaNoS13, aiCard)
    expect(state.selections['sector']).toEqual(['S1'])
  })
})

describe('unplacedMultiSelections — configuraciones impintables', () => {
  it('detecta varios valores fuera de filas/columnas y respeta lo colocado', async () => {
    const { unplacedMultiSelections } = await import('./builderModel')
    const base = initialBuilderState(schema, card)
    const ambiguous = {
      ...base,
      selections: { ...base.selections, unit: ['CP_MEUR', 'CLV20_MEUR'] },
    }
    expect(unplacedMultiSelections(ambiguous)).toEqual(['unit'])
    const placed = { ...ambiguous, rows: ['unit'], columns: ['time'] }
    expect(unplacedMultiSelections(placed)).toEqual([])
    const single = { ...base, selections: { ...base.selections, unit: ['CP_MEUR'] } }
    expect(unplacedMultiSelections(single)).toEqual([])
  })
})
