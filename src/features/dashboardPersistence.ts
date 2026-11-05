import type { Dashboard, Panel, VizType } from '../core/types'
import { isPivotSpecLike } from './panelUrlCodec'

/**
 * EUROPIVOT — Persistencia del dashboard (T11, RF-19). Sin backend en
 * v1: el dashboard vive en localStorage del navegador, con nombre,
 * fecha de guardado y, por panel, su spec completa, título, tipo de
 * visualización y tamaño. Se guarda AUTOMÁTICAMENTE en cada cambio
 * (RF-18) — no hay botón de guardar que olvidar.
 *
 * La lectura valida panel a panel: una entrada corrupta se descarta,
 * nunca tumba la app ni el resto del dashboard.
 */

export const DASHBOARD_STORAGE_KEY = 'europivot.dashboard.v1'

const VIZ_TYPES: VizType[] = ['table', 'line', 'bar', 'map', 'ranking', 'kpi']

export function serializeDashboard(dashboard: Dashboard): string {
  return JSON.stringify(dashboard)
}

export function deserializeDashboard(raw: string | null): Dashboard | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const d = parsed as Partial<Dashboard>
    if (!Array.isArray(d.panels)) return null
    const panels: Panel[] = []
    for (const p of d.panels as Partial<Panel>[]) {
      if (typeof p !== 'object' || p === null) continue
      if (typeof p.id !== 'string' || typeof p.title !== 'string') continue
      if (!isPivotSpecLike(p.spec)) continue
      panels.push({
        id: p.id,
        title: p.title,
        viz: VIZ_TYPES.includes(p.viz as VizType) ? (p.viz as VizType) : 'line',
        spec: p.spec,
        rect: {
          x: 0,
          y: panels.length,
          w: p.rect?.w === 2 ? 2 : 1,
          h: 1,
        },
      })
    }
    if (panels.length === 0) return null
    return {
      id: typeof d.id === 'string' ? d.id : 'dashboard-local',
      name: typeof d.name === 'string' && d.name.length > 0 ? d.name : 'Mi dashboard',
      panels,
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : undefined,
    }
  } catch {
    return null
  }
}

export function loadPersistedDashboard(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Dashboard | null {
  try {
    return deserializeDashboard(storage.getItem(DASHBOARD_STORAGE_KEY))
  } catch {
    return null
  }
}

export function persistDashboard(
  dashboard: Dashboard | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (!dashboard || dashboard.panels.length === 0) {
      storage.removeItem(DASHBOARD_STORAGE_KEY)
    } else {
      storage.setItem(DASHBOARD_STORAGE_KEY, serializeDashboard(dashboard))
    }
  } catch {
    // Almacenamiento lleno o bloqueado: el dashboard sigue en memoria;
    // la persistencia es una comodidad, no un requisito para funcionar.
  }
}
