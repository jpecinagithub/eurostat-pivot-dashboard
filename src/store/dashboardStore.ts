import { create } from 'zustand'
import type { Dashboard } from '../core/types'
import { DEFAULT_UI_LANG, type UiLang } from '../i18n/dictionaries'

/**
 * Store global (SDD §4.2). En T01 solo guarda idioma de cáscara y el dashboard
 * activo (vacío). La persistencia en localStorage y el codec de URL llegan
 * en T09b (un panel) y T11 (dashboard completo) — RF-19/RF-20.
 */
interface AppState {
  uiLang: UiLang
  dashboard: Dashboard | null
  /** Dataset elegido en la Home (T07); el constructor T08 lo consume. */
  selectedDataset: string | null
  setUiLang: (lang: UiLang) => void
  setDashboard: (dashboard: Dashboard | null) => void
  setSelectedDataset: (code: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  uiLang: DEFAULT_UI_LANG,
  dashboard: null,
  selectedDataset: null,
  setUiLang: (uiLang) => set({ uiLang }),
  setDashboard: (dashboard) => set({ dashboard }),
  setSelectedDataset: (selectedDataset) => set({ selectedDataset }),
}))
