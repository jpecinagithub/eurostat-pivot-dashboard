// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from '../components/Panel'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'

/**
 * Regresión del pantallazo vacío (reportado por Jon, 2026-11-05):
 * una spec con DOS valores en una dimensión que no está ni en filas
 * ni en columnas (p. ej. dos unidades) hace que el motor pivot lance
 * PivotAmbiguityError. El panel debe pintar un aviso claro con la
 * dimensión — nunca tumbarse la app entera a negro.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function fabricatedTwoUnits(): string {
  // freq × unit(2) × geo(ES) × time(2024, 2025), valores en las 4 celdas.
  return JSON.stringify({
    version: '2.0',
    class: 'dataset',
    label: 'Fabricated two-unit dataset',
    source: 'ESTAT',
    updated: '2026-10-22T23:00:00+0200',
    id: ['freq', 'unit', 'geo', 'time'],
    size: [1, 2, 1, 2],
    dimension: {
      freq: { category: { index: { A: 0 } } },
      unit: {
        category: {
          index: { CP_MEUR: 0, CLV20_MEUR: 1 },
          label: { CP_MEUR: 'Current prices, million euro', CLV20_MEUR: 'Chain-linked volumes' },
        },
      },
      geo: { category: { index: { ES: 0 }, label: { ES: 'Spain' } } },
      time: { category: { index: { '2024': 0, '2025': 1 } } },
    },
    value: { '0': 100, '1': 110, '2': 90, '3': 99 },
    extension: { status: { label: {} } },
  })
}

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fabricatedTwoUnits(),
      json: async () => ({}),
    })),
  )
  useAppStore.setState({
    builderSpec: {
      dataset: 'nama_10_gdp',
      lang: 'EN',
      filters: { unit: ['CP_MEUR', 'CLV20_MEUR'], geo: ['ES'] },
      time: { mode: 'values', values: ['2024', '2025'] },
      rows: ['geo'],
      columns: ['time'],
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  container?.remove()
  container = null
  useAppStore.setState({ builderSpec: null })
})

describe('Panel — configuración ambigua (regresión pantallazo vacío)', () => {
  it('pinta un aviso con la dimensión en vez de tumbar la app', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(Panel))

    await vi.waitFor(() => expect(container!.textContent).toContain('varios valores'), {
      timeout: 15000,
      interval: 100,
    })
    // La app sigue viva: el panel y su dataset están en pantalla.
    expect(container.textContent).toContain('nama_10_gdp')
    expect(container.textContent).toContain('Unidad')
    root.unmount()
  }, 30000)
})
