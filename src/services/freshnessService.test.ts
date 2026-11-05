import { describe, expect, it } from 'vitest'
import type { PivotSpec } from '../core/types'
import { _resetQueuesForTests } from './eurostatClient'
import {
  isNewer,
  lastBrusselsWindow,
  loadSeen,
  nextBrusselsCheck,
  probeSpecFor,
  probeUpdated,
  recordSeen,
} from './freshnessService'

/**
 * T13 / RF-22/23 — agenda alineada al ciclo de Eurostat (11:00 y
 * 23:00 Europe/Brussels, con margen de 5 minutos), registro local de
 * `updated` vistos y probe mínimo presupuestado.
 */

describe('Agenda de Bruselas (RF-23)', () => {
  it('invierno: a las 10:00 de Bruselas la próxima ventana es 11:05', () => {
    // 2026-11-05T09:00Z = 10:00 CET en Bruselas.
    expect(nextBrusselsCheck(new Date('2026-11-05T09:00:00Z')).toISOString()).toBe(
      '2026-11-05T10:05:00.000Z',
    )
  })

  it('invierno: a las 13:00 la próxima es 23:05; a las 23:30, mañana 11:05', () => {
    expect(nextBrusselsCheck(new Date('2026-11-05T12:00:00Z')).toISOString()).toBe(
      '2026-11-05T22:05:00.000Z',
    )
    expect(nextBrusselsCheck(new Date('2026-11-05T22:30:00Z')).toISOString()).toBe(
      '2026-11-06T10:05:00.000Z',
    )
  })

  it('verano (CEST): la ventana de las 11:05 son las 09:05Z', () => {
    expect(nextBrusselsCheck(new Date('2026-07-01T08:00:00Z')).toISOString()).toBe(
      '2026-07-01T09:05:00.000Z',
    )
  })

  it('última ventana de carga: a las 10:30Z de un día de invierno fue la de las 23:00 de ayer', () => {
    // 2026-11-05T10:30Z = 11:30 CET: ya pasó la de las 11:00 de hoy.
    expect(lastBrusselsWindow(new Date('2026-11-05T10:30:00Z')).toISOString()).toBe(
      '2026-11-05T10:00:00.000Z',
    )
    // 09:30Z = 10:30 CET: aún no llegó la de las 11:00; la última es ayer 23:00 (=22:00Z).
    expect(lastBrusselsWindow(new Date('2026-11-05T09:30:00Z')).toISOString()).toBe(
      '2026-11-04T22:00:00.000Z',
    )
  })
})

describe('Registro de vistos + comparación', () => {
  function fakeStorage() {
    const map = new Map<string, string>()
    return {
      map,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
  }

  it('recordSeen/loadSeen ida y vuelta; corrupción → {}', () => {
    const s = fakeStorage()
    recordSeen('nama_10_gdp', '2026-10-22T23:00:00+0200', s)
    expect(loadSeen(s)).toEqual({ nama_10_gdp: '2026-10-22T23:00:00+0200' })
    s.map.set('europivot.freshness.v1', 'no-json')
    expect(loadSeen(s)).toEqual({})
  })

  it('isNewer compara instantes, no textos', () => {
    expect(isNewer('2026-11-05T23:00:00+0100', '2026-10-22T23:00:00+0200')).toBe(true)
    expect(isNewer('2026-10-22T23:00:00+0200', '2026-10-22T23:00:00+0200')).toBe(false)
    expect(isNewer('2026-10-22T23:00:00+0200', '2026-11-05T23:00:00+0100')).toBe(false)
  })
})

describe('Probe presupuestado (RF-22)', () => {
  const SPEC: PivotSpec = {
    dataset: 'nama_10_gdp',
    lang: 'EN',
    filters: { unit: ['CP_MEUR', 'CLV20_MEUR'], na_item: ['B1GQ'], geo: ['ES', 'FR', 'DE'] },
    time: { mode: 'last', n: 10 },
    rows: ['geo'],
    columns: ['time'],
  }

  it('probeSpecFor reduce a un valor por dimensión y un periodo', () => {
    const probe = probeSpecFor(SPEC)
    expect(probe.filters).toEqual({ unit: ['CP_MEUR'], na_item: ['B1GQ'], geo: ['ES'] })
    expect(probe.time).toEqual({ mode: 'last', n: 1 })
  })

  it('probeUpdated lee solo el campo updated de la respuesta', async () => {
    _resetQueuesForTests()
    let requestedUrl = ''
    const fetchImpl = (async (url: string) => {
      requestedUrl = String(url)
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ updated: '2026-11-05T23:00:00+0100', value: {} }),
      }
    }) as unknown as typeof fetch
    const updated = await probeUpdated(SPEC, fetchImpl)
    expect(updated).toBe('2026-11-05T23:00:00+0100')
    expect(requestedUrl).toContain('lastTimePeriod=1')
    expect(requestedUrl).toContain('geo=ES')
    expect(requestedUrl).not.toContain('geo=FR')
  })
})
