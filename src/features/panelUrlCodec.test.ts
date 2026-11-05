import { describe, expect, it } from 'vitest'
import type { PivotSpec } from '../core/types'
import {
  M1_SPEC,
  buildPanelUrl,
  decodePanelParam,
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
