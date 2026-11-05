// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import { _resetGeoCacheForTests } from '../services/geoService'
import { DASHBOARD_STORAGE_KEY } from './dashboardPersistence'
import { buildDashboardUrl } from './panelUrlCodec'
import type { PivotSpec } from '../core/types'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'
import demoFixture from '../services/__fixtures__/demo_r_d3dens.country.2020-2024.json'

/**
 * Aceptación de T11 en «navegador limpio» + P1 (QA 2026-11-05): una
 * URL `?d=` con paneles de DOS datasets distintos reconstruye el
 * dashboard entero (tablas con datos de ambas fixtures reales) en
 * modo SOLO CONSULTA: el dashboard PROPIO guardado en localStorage
 * NO se sobrescribe. Solo el botón expreso «Guardar una copia» lo
 * sustituye.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NAMA_SPEC: PivotSpec = {
  dataset: 'nama_10_gdp',
  lang: 'EN',
  filters: { unit: ['CP_MEUR'], na_item: ['B1GQ'], geo: ['DE', 'ES', 'FR'] },
  time: { mode: 'values', values: ['2023', '2024', '2025'] },
  rows: ['geo'],
  columns: ['time'],
}

const DEMO_SPEC: PivotSpec = {
  dataset: 'demo_r_d3dens',
  lang: 'EN',
  filters: { unit: ['PER_KM2'] },
  geoLevel: 'country',
  time: { mode: 'values', values: ['2020', '2021', '2022', '2023', '2024'] },
  rows: ['geo'],
  columns: ['time'],
}

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  _resetGeoCacheForTests()
  localStorage.clear()
  useAppStore.setState({ dashboard: null, builderSpec: null, selectedDataset: null })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url)
      const body = u.includes('demo_r_d3dens')
        ? demoFixture
        : u.includes('nama_10_gdp')
          ? namaFixture
          : null
      return {
        ok: true,
        status: 200,
        text: async () => (body ? JSON.stringify(body) : '{}'),
        json: async () => ({}),
      }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  container?.remove()
  container = null
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  useAppStore.setState({ dashboard: null, builderSpec: null, selectedDataset: null })
})

const OWN_DASHBOARD = {
  id: 'propio',
  name: 'Mi trabajo original',
  panels: [
    {
      id: 'p-propio',
      title: 'Mi panel',
      viz: 'line',
      spec: NAMA_SPEC,
      rect: { x: 0, y: 0, w: 1, h: 1 },
    },
  ],
  savedAt: '2026-11-01T10:00:00.000Z',
}

describe('Arranque con enlace de dashboard (T11 + P1)', () => {
  it('reconstruye el compartido SIN sobrescribir el propio guardado', async () => {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(OWN_DASHBOARD))
    window.history.replaceState(
      null,
      '',
      buildDashboardUrl(window.location.href, 'Proyecto ajeno', [
        { spec: NAMA_SPEC, title: 'PIB ajeno', viz: 'table', wide: true },
        { spec: DEMO_SPEC },
      ]),
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(App))

    // Dato dorado del panel de PIB (ES 2025) y del de densidad (ES 2024).
    await vi.waitFor(() => expect(container!.textContent).toContain('1.690.012'), {
      timeout: 20000,
      interval: 100,
    })
    await vi.waitFor(() => expect(container!.textContent).toContain('97,2'), {
      timeout: 20000,
      interval: 100,
    })
    // El nombre del COMPARTIDO se ve en pantalla, con su título de
    // panel personalizado (metadatos del enlace, QA 2026-11-05)…
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Mi dashboard"]',
    )
    expect(nameInput?.value).toBe('Proyecto ajeno')
    expect(container.textContent).toContain('Estás viendo un dashboard compartido')
    // …pero el almacenamiento sigue conteniendo el dashboard PROPIO.
    const intacto = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY)!)
    expect(intacto.name).toBe('Mi trabajo original')
    expect(useAppStore.getState().dashboardShared).toBe(true)

    // La acción expresa «Guardar una copia» SÍ sustituye el guardado.
    const saveBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Guardar una copia'),
    )
    expect(saveBtn).toBeTruthy()
    saveBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => {
      const now = JSON.parse(localStorage.getItem(DASHBOARD_STORAGE_KEY)!)
      expect(now.name).toBe('Proyecto ajeno')
      expect(now.panels).toHaveLength(2)
    })
    expect(useAppStore.getState().dashboardShared).toBe(false)
    root.unmount()
  }, 40000)
})
