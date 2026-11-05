import { describe, expect, it } from 'vitest'
import { JsonStatParseError, parseJsonStat } from './jsonstatParser'
import demoFixture from './__fixtures__/demo_r_d3dens.country.2020-2024.json'
import namaFixture from './__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'

describe('parseJsonStat — fixture nama_10_gdp (PIB, DE/ES/FR, 2023–2025)', () => {
  const parsed = parseJsonStat(namaFixture, 'nama_10_gdp')

  it('aplanan las 9 observaciones del cubo 1×1×1×3×3', () => {
    expect(parsed.totalCells).toBe(9)
    expect(parsed.cellsWithValue).toBe(9)
    expect(parsed.rows).toHaveLength(9)
  })

  it('celdas conocidas coinciden con el cálculo de strides independiente', () => {
    const cell = (geo: string, time: string) =>
      parsed.rows.find((r) => r['geo'] === geo && r['time'] === time)
    // Verificado a mano desde el mapa disperso de la fixture (flat = geoIdx·3 + timeIdx).
    expect(cell('ES', '2025')?.value).toBe(1690012)
    expect(cell('ES', '2025')?.status).toBe('p')
    expect(cell('DE', '2023')?.value).toBe(4254930)
    expect(cell('FR', '2024')?.value).toBe(2935236.2)
  })

  it('el status se preserva celda a celda (7 de 9; ES-2023 y FR-2023 no tienen)', () => {
    expect(parsed.rows.filter((r) => r.status !== undefined)).toHaveLength(7)
    const es2023 = parsed.rows.find((r) => r['geo'] === 'ES' && r['time'] === '2023')
    expect(es2023?.status).toBeUndefined()
  })

  it('cada fila reconstruye su posición plana en el mapa original (ida y vuelta)', () => {
    const raw = namaFixture as unknown as {
      dimension: Record<string, { category: { index: Record<string, number> } }>
      size: number[]
      id: string[]
      value: Record<string, number>
    }
    const strides = raw.size.map((_, i) =>
      raw.size.slice(i + 1).reduce((acc, n) => acc * n, 1),
    )
    for (const row of parsed.rows) {
      const flat = raw.id.reduce(
        (acc, dim, i) => acc + raw.dimension[dim].category.index[row[dim]] * strides[i],
        0,
      )
      expect(raw.value[String(flat)]).toBe(row.value)
    }
  })

  it('metadatos: updated, etiqueta y OBS_COUNT como total del dataset (no de la extracción)', () => {
    expect(parsed.meta.updated).toBe('2026-10-22T23:00:00+0200')
    expect(parsed.meta.obsCountTotal).toBe(1087862)
    expect(parsed.meta.obsCountTotal).not.toBe(parsed.rows.length)
    expect(parsed.meta.statusLabels['p']).toBe('provisional')
    expect(parsed.schema.dims.map((d) => d.id)).toEqual([
      'freq',
      'unit',
      'na_item',
      'geo',
      'time',
    ])
    const geo = parsed.schema.dims.find((d) => d.id === 'geo')
    expect(geo?.role).toBe('geo')
    expect(geo?.categories.map((c) => c.code)).toEqual(['DE', 'ES', 'FR'])
    expect(geo?.categories.every((c: { label: string }) => c.label.length > 0)).toBe(true)
  })
})

describe('parseJsonStat — fixture demo_r_d3dens dispersa (geoLevel=country, 2020–2024)', () => {
  const parsed = parseJsonStat(demoFixture, 'demo_r_d3dens')

  it('185 celdas, 174 con valor: la ausencia NO se convierte en 0 (C3)', () => {
    expect(parsed.totalCells).toBe(185)
    expect(parsed.rows).toHaveLength(174)
    expect(parsed.rows.every((r) => typeof r.value === 'number')).toBe(true)
  })

  it('las 26 banderas status sobreviven al aplanado, con sus textos oficiales', () => {
    expect(parsed.rows.filter((r) => r.status !== undefined)).toHaveLength(26)
    expect(parsed.rows.some((r) => r.status === 'e')).toBe(true)
    expect(parsed.meta.statusLabels['e']).toBe('estimated')
    expect(parsed.meta.statusLabels['b']).toBe('break in time series')
  })

  it('los periodos son los 5 pedidos; el esquema trae 37 geo y las filas 36', () => {
    expect(new Set(parsed.rows.map((r) => r['time']))).toEqual(
      new Set(['2020', '2021', '2022', '2023', '2024']),
    )
    const geoDim = parsed.schema.dims.find((d) => d.id === 'geo')
    expect(geoDim?.categories).toHaveLength(37)
    // Una geo no tiene NI UNA observación en 2020–2024: está en el esquema
    // pero no genera filas. Es la ausencia ≠ 0 de C3 a nivel de categoría.
    expect(new Set(parsed.rows.map((r) => r['geo'])).size).toBe(36)
  })
})

describe('parseJsonStat — formas alternativas y errores', () => {
  it('acepta value/status como arrays densos (null = ausencia)', () => {
    const dense = {
      version: '2.0',
      class: 'dataset',
      label: 'Sintético denso',
      id: ['geo', 'time'],
      size: [2, 2],
      dimension: {
        geo: { label: 'Geopolitical entity', category: { index: { ES: 0, FR: 1 }, label: { ES: 'Spain', FR: 'France' } } },
        time: { label: 'Time', category: { index: { '2023': 0, '2024': 1 } } },
      },
      value: [10, null, 30, 40],
      status: [null, null, 'p', null],
    }
    const parsed = parseJsonStat(dense, 'synthetic')
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows.map((r) => [r['geo'], r['time'], r.value])).toEqual([
      ['ES', '2023', 10],
      ['FR', '2023', 30],
      ['FR', '2024', 40],
    ])
    expect(parsed.rows[1].status).toBe('p')
  })

  it('rechaza documentos que no son datasets JSON-stat', () => {
    expect(() => parseJsonStat(null)).toThrowError(JsonStatParseError)
    expect(() => parseJsonStat({ hello: 'world' })).toThrowError(JsonStatParseError)
    expect(() => parseJsonStat('texto')).toThrowError(JsonStatParseError)
  })
})
