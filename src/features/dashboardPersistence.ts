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
    // P3 (QA 2026-11-05): una fecha de guardado ilegible NO debe
    // tumbar la app al formatearla ("Invalid time value") — se valida
    // aquí, a la entrada, y una fecha inválida se descarta (el
    // dashboard se recupera sin fecha).
    const savedAt =
      typeof d.savedAt === 'string' && Number.isFinite(Date.parse(d.savedAt))
        ? new Date(d.savedAt).toISOString()
        : undefined
    return {
      id: typeof d.id === 'string' ? d.id : 'dashboard-local',
      name: typeof d.name === 'string' && d.name.length > 0 ? d.name : 'Mi dashboard',
      panels,
      savedAt,
    }
  } catch {
    return null
  }
}

/**
 * P2 (QA 2026-11-05): en navegadores que DENIEGAN el acceso a
 * localStorage, el simple hecho de REFERENCIAR el objeto lanza
 * SecurityError. Si eso ocurre al crear el store (arranque), la app
 * entera quedaba en blanco. Por eso el acceso vive dentro de un
 * try/catch y se resuelve perezosamente: sin almacenamiento, la app
 * arranca y funciona en memoria.
 */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function loadPersistedDashboard(storage?: Pick<Storage, 'getItem'>): Dashboard | null {
  try {
    const s = storage ?? safeLocalStorage()
    if (!s) return null
    return deserializeDashboard(s.getItem(DASHBOARD_STORAGE_KEY))
  } catch {
    return null
  }
}

export function persistDashboard(
  dashboard: Dashboard | null,
  storage?: Pick<Storage, 'setItem' | 'removeItem'>,
): void {
  try {
    const s = storage ?? safeLocalStorage()
    if (!s) return
    if (!dashboard || dashboard.panels.length === 0) {
      s.removeItem(DASHBOARD_STORAGE_KEY)
    } else {
      s.setItem(DASHBOARD_STORAGE_KEY, serializeDashboard(dashboard))
    }
  } catch {
    // Almacenamiento lleno o bloqueado: el dashboard sigue en memoria;
    // la persistencia es una comodidad, no un requisito para funcionar.
  }
}
