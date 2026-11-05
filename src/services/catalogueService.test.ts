import { describe, expect, it } from 'vitest'
import {
  filterByTheme,
  getByCode,
  listThemes,
  loadCatalogueIndex,
  normalizeText,
  searchCatalogue,
  type CatalogueIndex,
} from './catalogueService'

const mini: CatalogueIndex = {
  version: 1,
  generatedAt: '2026-11-05T00:00:00.000Z',
  source: 'test',
  entries: [
    { code: 'nama_10_gdp', title: 'Gross domestic product (GDP) and main components - annual data', type: 'dataset', theme: ['Economy and finance', 'National accounts'] },
    { code: 'namq_10_gdp', title: 'Gross domestic product (GDP) and main components - quarterly data', type: 'dataset', theme: ['Economy and finance', 'National accounts'] },
    { code: 'demo_pjan', title: 'Population on 1 January by age and sex', type: 'dataset', theme: ['Population and social conditions', 'Demography'] },
    { code: 'demo_gind', title: 'Population change - demographic balance', type: 'dataset', theme: ['Population and social conditions', 'Demography'] },
  ],
}

describe('catalogueService — búsqueda', () => {
  it('normaliza diacríticos y mayúsculas', () => {
    expect(normalizeText('Población ÍNDICE')).toBe('poblacion indice')
  })

  it('el código exacto gana a cualquier coincidencia de título', () => {
    const hits = searchCatalogue(mini, 'nama_10_gdp')
    expect(hits[0].code).toBe('nama_10_gdp')
  })

  it('busca por palabras del título (todas deben aparecer)', () => {
    expect(searchCatalogue(mini, 'gross domestic').map((e) => e.code)).toEqual([
      'nama_10_gdp',
      'namq_10_gdp',
    ])
    expect(searchCatalogue(mini, 'population demographic')).toHaveLength(1)
    expect(searchCatalogue(mini, 'population demographic')[0].code).toBe('demo_gind')
  })

  it('consulta vacía o sin coincidencias → lista vacía', () => {
    expect(searchCatalogue(mini, '')).toEqual([])
    expect(searchCatalogue(mini, 'zzz inexistente')).toEqual([])
  })

  it('getByCode ignora mayúsculas; temas y filtro por tema', () => {
    expect(getByCode(mini, 'DEMO_PJAN')?.title).toContain('Population on 1 January')
    expect(getByCode(mini, 'no_existe')).toBeUndefined()
    expect(listThemes(mini)).toEqual([
      { theme: 'Economy and finance', count: 2 },
      { theme: 'Population and social conditions', count: 2 },
    ])
    expect(filterByTheme(mini, 'Population and social conditions')).toHaveLength(2)
  })
})

describe('catalogueService — índice real generado del TOC (T04)', () => {
  it('carga el índice de build con el catálogo completo y metadatos del TOC', async () => {
    const index = await loadCatalogueIndex()
    expect(index.version).toBe(1)
    expect(index.generatedAt).toBeTruthy()
    expect(index.entries.length).toBeGreaterThanOrEqual(10000)

    const nama = getByCode(index, 'nama_10_gdp')
    expect(nama?.type).toBe('dataset')
    expect(nama?.theme.length).toBeGreaterThan(0)
    // El TOC y la respuesta JSON-stat coinciden: 1.087.862 valores (cf. T03).
    expect(nama?.values).toBe(1087862)
    expect(nama?.lastUpdate).toBe('2026-10-22')

    // Varios datasets comparten «Unemployment by sex and age…»: la búsqueda
    // por título devuelve el conjunto; el código exacto sí es determinista.
    const hits = searchCatalogue(index, 'unemployment by sex and age')
    expect(hits.map((e) => e.code)).toContain('une_rt_m')
    expect(searchCatalogue(index, 'une_rt_m')[0]?.code).toBe('une_rt_m')
    expect(listThemes(index).length).toBeGreaterThanOrEqual(9)
    // Timeout amplio: importar el índice real (10.408 entradas) bajo
    // carga paralela puede superar los 5 s por defecto sin fallar.
  }, 30000)
})
