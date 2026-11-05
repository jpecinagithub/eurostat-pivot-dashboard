import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Home from '../components/Home'
import type { CatalogueIndex } from '../services/catalogueService'
import { fmtDateEs, packCardsWithMetadata, topThemes } from './homeModel'

// Índice mínimo con la forma real (la carga perezosa usa el de disco).
const miniIndex: CatalogueIndex = {
  version: 1,
  generatedAt: '2026-11-05T00:00:00Z',
  source: 'test',
  entries: [
    {
      code: 'nama_10_gdp',
      title: 'GDP and main components',
      type: 'dataset',
      theme: ['Economy and finance', 'National accounts'],
      lastUpdate: '2026-10-22',
      dataStart: '1975',
      dataEnd: '2025',
      values: 1087862,
    },
    {
      code: 'demo_pjan',
      title: 'Population on 1 January',
      type: 'dataset',
      theme: ['Population and social conditions', 'Demography'],
      lastUpdate: '2026-07-10',
      values: 500000,
    },
    {
      code: 'ext_lt_introm',
      title: 'Imports',
      type: 'dataset',
      theme: ['International trade'],
      values: 1000,
    },
  ],
}

describe('Home model (T07)', () => {
  it('topThemes refleja las carpetas reales del TOC, con etiqueta ES cuando se conoce', () => {
    const themes = topThemes(miniIndex)
    expect(themes).toHaveLength(3)
    expect(themes.find((th) => th.name === 'Economy and finance')?.labelEs).toBe(
      'Economía y finanzas',
    )
    // «International trade» casa con la etiqueta oficial por prefijo.
    expect(themes.find((th) => th.name === 'International trade')?.labelEs).toBe(
      'Comercio internacional de bienes',
    )
    expect(themes.reduce((acc, th) => acc + th.count, 0)).toBe(3)
  })

  it('las tarjetas del pack llevan la fecha de METADATOS del índice (RF-22)', () => {
    const cards = packCardsWithMetadata(miniIndex)
    const gdp = cards.find((c) => c.code === 'nama_10_gdp')
    expect(gdp?.updatedMeta).toBe('2026-10-22')
    expect(gdp?.values).toBe(1087862)
    // Sin índice cargado aún, la tarjeta sigue existiendo (sin fecha meta).
    const noIndex = packCardsWithMetadata(null)
    expect(noIndex).toHaveLength(33)
    expect(noIndex[0].updatedMeta).toBeUndefined()
  })

  it('fmtDateEs formatea en español y tolera basura', () => {
    expect(fmtDateEs('2026-10-22')).toContain('2026')
    expect(fmtDateEs('2026-10-22')).toContain('oct')
    expect(fmtDateEs(undefined)).toBeUndefined()
    expect(fmtDateEs('no-es-fecha')).toBe('no-es-fecha')
  })
})

describe('Home — render inicial', () => {
  it('pinta el buscador y las 19 tarjetas del pack con títulos ES', () => {
    // React separa los fragmentos de texto con comentarios <!-- -->.
    const html = renderToString(createElement(Home)).replaceAll('<!-- -->', ' ')
    expect(html).toContain('id="catalogue-search"')
    expect(html).toContain('PIB y componentes principales (anual)')
    expect(html).toContain('IPCA mensual — índices y tasas (ECOICOP v2)')
    expect(html).toContain('Datos hasta   2026-10')
  })
})
