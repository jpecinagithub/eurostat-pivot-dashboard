import { create } from 'zustand'
import type { Dashboard, Panel, PivotSpec, VizType } from '../core/types'
import {
  loadPersistedDashboard,
  persistDashboard,
} from '../features/dashboardPersistence'
import { DEFAULT_UI_LANG, type UiLang } from '../i18n/dictionaries'

/**
 * Store global (SDD §4.2). Dashboard multipanel desde T11 (RF-17/18/
 * 19): paneles independientes, cada uno con su PivotSpec completo; el
 * estado se persiste solo en localStorage en cada cambio y se restaura
 * al arrancar (si la URL trae un enlace compartido, App lo impone
 * encima — el enlace manda sobre lo guardado).
 */
interface AppState {
  uiLang: UiLang
  dashboard: Dashboard | null
  /**
   * P1 (QA 2026-11-05): true cuando el dashboard actual llegó por un
   * enlace compartido (?d=). Un dashboard compartido es SOLO CONSULTA:
   * nunca se persiste automáticamente, para que abrir el enlace de
   * otra persona no destruya el dashboard propio guardado. Solo una
   * acción expresa (saveSharedDashboard) lo convierte en copia propia.
   */
  dashboardShared: boolean
  /**
   * Contador de persistencia: SOLO sube cuando cambia el dashboard
   * PROPIO (o cuando el usuario guarda expresamente una copia del
   * compartido). La suscripción persiste al cambiar este contador —
   * así un dashboard compartido no escribe en el almacenamiento ni
   * al mostrarse, ni al editarse en pantalla, ni al descartarse.
   */
  persistSeq: number
  /** Dataset elegido en la Home (T07); el constructor T08 lo consume. */
  selectedDataset: string | null
  /** Señal para llevar foco+scroll al constructor (QA móvil). */
  builderScrollSignal: number
  /** Configuración confirmada en el constructor (T08); el panel T09 la pinta. */
  builderSpec: PivotSpec | null
  setUiLang: (lang: UiLang) => void
  setDashboard: (dashboard: Dashboard | null, opts?: { shared?: boolean }) => void
  /** Guarda expresamente el dashboard compartido como copia propia. */
  saveSharedDashboard: () => void
  requestBuilderScroll: () => void
  setSelectedDataset: (code: string | null) => void
  setBuilderSpec: (spec: PivotSpec | null) => void
  /** Fija la spec dada como panel nuevo del dashboard (RF-17). */
  addPanel: (spec: PivotSpec, title: string) => void
  removePanel: (panelId: string) => void
  movePanel: (panelId: string, dir: -1 | 1) => void
  setPanelTitle: (panelId: string, title: string) => void
  setPanelViz: (panelId: string, viz: VizType) => void
  setPanelWide: (panelId: string, wide: boolean) => void
  setDashboardName: (name: string) => void
}

let idCounter = 0
function newId(prefix: string): string {
  idCounter += 1
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${idCounter}`
}

function touch(dashboard: Dashboard, panels: Panel[]): Dashboard {
  return { ...dashboard, panels, savedAt: new Date().toISOString() }
}

export const useAppStore = create<AppState>((set, get) => {
  /** Cambio del dashboard PROPIO: se marca para persistir. */
  const commit = (dashboard: Dashboard | null) =>
    set({ dashboard, persistSeq: get().persistSeq + 1 })
  /** Cambio solo visual (dashboard compartido): nunca persiste. */
  const apply = (dashboard: Dashboard | null) => {
    if (get().dashboardShared) set({ dashboard })
    else commit(dashboard)
  }
  return {
  uiLang: DEFAULT_UI_LANG,
  dashboard: loadPersistedDashboard(),
  dashboardShared: false,
  persistSeq: 0,
  selectedDataset: null,
  builderScrollSignal: 0,
  builderSpec: null,
  setUiLang: (uiLang) => set({ uiLang }),
  setDashboard: (dashboard, opts) => {
    const next = dashboard ? touch(dashboard, dashboard.panels) : null
    if (opts?.shared === true) {
      set({ dashboard: next, dashboardShared: true })
    } else if (dashboard === null && get().dashboardShared) {
      // Descartar la VISTA compartida no borra el guardado propio.
      set({ dashboard: null, dashboardShared: false })
    } else {
      set({ dashboardShared: false })
      commit(next)
    }
  },
  saveSharedDashboard: () => {
    const current = get().dashboard
    if (!current) return
    set({
      dashboard: touch(current, current.panels),
      dashboardShared: false,
      persistSeq: get().persistSeq + 1,
    })
  },
  requestBuilderScroll: () =>
    set((state) => ({ builderScrollSignal: state.builderScrollSignal + 1 })),
  setSelectedDataset: (selectedDataset) => set({ selectedDataset }),
  setBuilderSpec: (builderSpec) => set({ builderSpec }),
  addPanel: (spec, title) => {
    const panel: Panel = {
      id: newId('panel'),
      title,
      viz: 'line',
      spec,
      rect: { x: 0, y: 0, w: 1, h: 1 },
    }
    const current = get().dashboard
    if (!current) {
      commit(
        touch({ id: newId('dashboard'), name: 'Mi dashboard', panels: [panel] }, [panel]),
      )
    } else {
      const panels = [...current.panels, panel].map((p, i) => ({
        ...p,
        rect: { ...p.rect, y: i },
      }))
      apply(touch(current, panels))
    }
  },
  removePanel: (panelId) => {
    const current = get().dashboard
    if (!current) return
    const panels = current.panels
      .filter((p) => p.id !== panelId)
      .map((p, i) => ({ ...p, rect: { ...p.rect, y: i } }))
    apply(panels.length === 0 ? null : touch(current, panels))
  },
  movePanel: (panelId, dir) => {
    const current = get().dashboard
    if (!current) return
    const idx = current.panels.findIndex((p) => p.id === panelId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= current.panels.length) return
    const panels = [...current.panels]
    const [moved] = panels.splice(idx, 1)
    panels.splice(target, 0, moved)
    apply(
      touch(
        current,
        panels.map((p, i) => ({ ...p, rect: { ...p.rect, y: i } })),
      ),
    )
  },
  setPanelTitle: (panelId, title) => {
    const current = get().dashboard
    if (!current) return
    apply(
      touch(
        current,
        current.panels.map((p) => (p.id === panelId ? { ...p, title } : p)),
      ),
    )
  },
  setPanelViz: (panelId, viz) => {
    const current = get().dashboard
    if (!current) return
    apply(
      touch(
        current,
        current.panels.map((p) => (p.id === panelId ? { ...p, viz } : p)),
      ),
    )
  },
  setPanelWide: (panelId, wide) => {
    const current = get().dashboard
    if (!current) return
    apply(
      touch(
        current,
        current.panels.map((p) =>
          p.id === panelId ? { ...p, rect: { ...p.rect, w: wide ? 2 : 1 } } : p,
        ),
      ),
    )
  },
  setDashboardName: (name) => {
    const current = get().dashboard
    if (!current) return
    apply(touch({ ...current, name }, current.panels))
  },
  }
})

// Persistencia automática (RF-18/RF-19): cualquier cambio del dashboard
// PROPIO se guarda en localStorage sin que el usuario tenga que
// acordarse. Un dashboard compartido (P1) no toca el almacenamiento:
// ni al mostrarlo, ni al editarlo en pantalla, ni al vaciarlo — el
// original guardado sobrevive intacto hasta que el usuario pida
// expresamente guardar una copia.
useAppStore.subscribe((state, prev) => {
  if (state.persistSeq !== prev.persistSeq) persistDashboard(state.dashboard)
})
