import { describe, expect, it } from 'vitest'
import type { Dashboard } from '../core/types'
import {
  DASHBOARD_STORAGE_KEY,
  deserializeDashboard,
  loadPersistedDashboard,
  persistDashboard,
  serializeDashboard,
} from './dashboardPersistence'
import { M1_SPEC } from './panelUrlCodec'

/**
 * T11/RF-19 — persistencia del dashboard: ida y vuelta fiel, lectura
 * tolerante a corrupción (un panel malo se descarta, no tumba nada) y
 * guardado/borrado contra un Storage cualquiera.
 */

const DASH: Dashboard = {
  id: 'd1',
  name: 'Mi panel de control',
  savedAt: '2026-11-05T10:00:00.000Z',
  panels: [
    {
      id: 'p1',
      title: 'PIB per cápita',
      viz: 'line',
      spec: M1_SPEC,
      rect: { x: 0, y: 0, w: 2, h: 1 },
    },
    {
      id: 'p2',
      title: 'Paro',
      viz: 'table',
      spec: {
        dataset: 'une_rt_m',
        lang: 'EN',
        filters: { unit: ['PC_ACT'], geo: ['ES'] },
        time: { mode: 'last', n: 12 },
        rows: ['geo'],
        columns: ['time'],
      },
      rect: { x: 0, y: 1, w: 1, h: 1 },
    },
  ],
}

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('Persistencia del dashboard (RF-19)', () => {
  it('ida y vuelta: nombre, paneles, viz y tamaño se conservan', () => {
    const back = deserializeDashboard(serializeDashboard(DASH))
    expect(back?.name).toBe('Mi panel de control')
    expect(back?.panels).toHaveLength(2)
    expect(back?.panels[0].spec).toEqual(M1_SPEC)
    expect(back?.panels[0].viz).toBe('line')
    expect(back?.panels[0].rect.w).toBe(2)
    expect(back?.panels[1].title).toBe('Paro')
  })

  it('un panel corrupto se descarta; el resto sobrevive', () => {
    const raw = JSON.parse(serializeDashboard(DASH)) as { panels: unknown[] }
    raw.panels[1] = { id: 'p2', title: 'Roto', spec: { dataset: 42 } }
    const back = deserializeDashboard(JSON.stringify(raw))
    expect(back?.panels).toHaveLength(1)
    expect(back?.panels[0].id).toBe('p1')
  })

  it('basura total → null; dashboard vacío → null', () => {
    expect(deserializeDashboard('no es json')).toBeNull()
    expect(deserializeDashboard(null)).toBeNull()
    expect(deserializeDashboard('{"panels":[]}')).toBeNull()
  })

  it('persist + load contra Storage; vaciar borra la clave', () => {
    const storage = fakeStorage()
    persistDashboard(DASH, storage)
    expect(storage.map.has(DASHBOARD_STORAGE_KEY)).toBe(true)
    expect(loadPersistedDashboard(storage)?.panels).toHaveLength(2)
    persistDashboard(null, storage)
    expect(storage.map.has(DASHBOARD_STORAGE_KEY)).toBe(false)
    expect(loadPersistedDashboard(storage)).toBeNull()
  })
})
