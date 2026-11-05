import { describe, expect, it } from 'vitest'
import type { PivotSpec } from '../core/types'
import {
  M1_SPEC,
  buildDashboardUrl,
  buildPanelUrl,
  dashboardFromSearch,
  decodeDashboardParam,
  decodePanelParam,
  encodeDashboardParam,
  encodePanelParam,
  specFromSearch,
} from './panelUrlCodec'

describe('Codec de URL de un panel (T09b, formato v1)', () => {
  it('ida y vuelta exacta de la spec M1', () => {
    const back = decodePanelParam(encodePanelParam(M1_SPEC))
    expect(back).toEqual(M1_SPEC)
  })

  it('ida y vuelta con geoLevel y tiempo por valores', () => {
    const spec: PivotSpec = {
      dataset: 'demo_r_d3dens',
      lang: 'EN',
      filters: { unit: ['PER_KM2'] },
      time: { mode: 'values', values: ['2020', '2024'] },
      geoLevel: 'country',
      rows: ['geo'],
      columns: ['time'],
    }
    expect(decodePanelParam(encodePanelParam(spec))).toEqual(spec)
  })

  it('la prueba M1: del enlace se recuperan países, unidad, periodos y referencia UE', () => {
    const url = buildPanelUrl('https://europivot.example/', M1_SPEC)
    const spec = specFromSearch(new URL(url).search)
    expect(spec).not.toBeNull()
    expect(spec!.filters['geo']).toEqual(['ES', 'FR', 'DE', 'EU27_2020'])
    expect(spec!.filters['unit']).toEqual(['CP_PPS_EU27_2020_HAB'])
    expect(spec!.time).toEqual({ mode: 'last', n: 10 })
    expect(spec!.dataset).toBe('nama_10_pc')
  })

  it('basura en la URL = null, nunca una excepción ni una spec inventada', () => {
    expect(decodePanelParam(null)).toBeNull()
    expect(decodePanelParam('')).toBeNull()
    expect(decodePanelParam('v2.loquesea')).toBeNull()
    expect(decodePanelParam('v1.%%%no-base64%%%')).toBeNull()
    expect(decodePanelParam('v1.' + btoa('{"v":1,"d":123}'))).toBeNull()
    expect(specFromSearch('?otra=cosa')).toBeNull()
    expect(specFromSearch('')).toBeNull()
  })
})

describe('Codec de dashboard (T11) y compatibilidad con M1', () => {
  // El enlace REAL entregado a Jon en M1 (2026-11-05): debe seguir
  // decodificando a la misma spec para siempre (compatibilidad T11).
  const M1_LINK_PARAM =
    'v1.eyJ2IjoxLCJkIjoibmFtYV8xMF9wYyIsImYiOnsidW5pdCI6WyJDUF9QUFNfRVUyN18yMDIwX0hBQiJdLCJuYV9pdGVtIjpbIkIxR1EiXSwiZ2VvIjpbIkVTIiwiRlIiLCJERSIsIkVVMjdfMjAyMCJdfSwidCI6eyJtb2RlIjoibGFzdCIsIm4iOjEwfSwiciI6WyJnZW8iXSwiYyI6WyJ0aW1lIl19'

  it('el enlace M1 original sigue abriendo la misma comparación', () => {
    expect(specFromSearch(`?p=${M1_LINK_PARAM}`)).toEqual(M1_SPEC)
  })

  it('ida y vuelta con paneles de dos datasets distintos', () => {
    const other: PivotSpec = {
      dataset: 'une_rt_m',
      lang: 'EN',
      filters: { unit: ['PC_ACT'], sex: ['T'], age: ['TOTAL'], s_adj: ['SA'], geo: ['ES', 'EU27_2020'] },
      time: { mode: 'last', n: 12 },
      rows: ['geo'],
      columns: ['time'],
    }
    const url = buildDashboardUrl('https://example.test/app', 'Mi panel de control', [M1_SPEC, other])
    const decoded = dashboardFromSearch(new URL(url).search)
    expect(decoded?.name).toBe('Mi panel de control')
    expect(decoded?.specs).toEqual([M1_SPEC, other])
    // Y el parámetro de dashboard NO se confunde con uno de panel suelto.
    expect(specFromSearch(new URL(url).search)).toBeNull()
  })

  it('basura o panel corrupto → null, nunca una excepción', () => {
    expect(dashboardFromSearch('?d=v1.@@@')).toBeNull()
    expect(dashboardFromSearch('?d=')).toBeNull()
    expect(dashboardFromSearch('')).toBeNull()
    const good = encodeDashboardParam('X', [M1_SPEC])
    expect(decodeDashboardParam(good)?.specs).toHaveLength(1)
    // Truncada a la mitad: JSON inválido → null.
    expect(decodeDashboardParam(good.slice(0, Math.floor(good.length / 2)))).toBeNull()
    // Un panel con versión desconocida invalida el enlace entero.
    const badWire =
      'v1.' +
      btoa(
        JSON.stringify({
          v: 1,
          panels: [{ v: 99, d: 'x', f: {}, t: { mode: 'last', n: 1 }, r: [], c: [] }],
        }),
      )
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '')
    expect(decodeDashboardParam(badWire)).toBeNull()
  })
})

describe('QA 2026-11-05 — el enlace de dashboard conserva título, vista y ancho', () => {
  it('ida y vuelta con metadatos por panel', () => {
    const url = buildDashboardUrl('https://europivot.example/', 'QA', [
      { spec: M1_SPEC, title: 'Prueba QA', viz: 'table', wide: true },
      { spec: { ...M1_SPEC, dataset: 'une_rt_m' } },
    ])
    const decoded = dashboardFromSearch(new URL(url).search)
    expect(decoded?.name).toBe('QA')
    expect(decoded?.panels[0]).toMatchObject({ title: 'Prueba QA', viz: 'table', wide: true })
    expect(decoded?.panels[0].spec).toEqual(M1_SPEC)
    expect(decoded?.panels[1].title).toBeUndefined()
    expect(decoded?.panels[1].viz).toBeUndefined()
  })

  it('un enlace ANTIGUO (paneles pelados, sin metadatos) sigue abriendo', () => {
    const legacyWire = {
      v: 1,
      name: 'Legado',
      panels: [
        {
          v: 1,
          d: 'nama_10_pc',
          f: { unit: ['CP_PPS_EU27_2020_HAB'], na_item: ['B1GQ'], geo: ['ES'] },
          t: { mode: 'last', n: 10 },
          r: ['geo'],
          c: ['time'],
        },
      ],
    }
    const bytes = new TextEncoder().encode(JSON.stringify(legacyWire))
    const param =
      'v1.' +
      btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')
    const decoded = decodeDashboardParam(param)
    expect(decoded?.name).toBe('Legado')
    expect(decoded?.panels[0].spec.dataset).toBe('nama_10_pc')
    expect(decoded?.panels[0].title).toBeUndefined()
    expect(decoded?.specs).toHaveLength(1)
  })
})
