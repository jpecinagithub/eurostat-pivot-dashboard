// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Builder from '../components/Builder'
import { useAppStore } from '../store/dashboardStore'
import dsdXml from '../services/__fixtures__/nama_10_gdp.datastructure.xml?raw'
import constraintXml from '../services/__fixtures__/nama_10_gdp.contentconstraint.xml?raw'

/**
 * Smoke del constructor (T08) con el esquema REAL de nama_10_gdp
 * servido por un fetch simulado: las dos llamadas SDMX de T05
 * responden con las fixtures XML grabadas en T05.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => (url.includes('datastructure') ? dsdXml : constraintXml),
    })),
  )
  useAppStore.setState({ selectedDataset: 'nama_10_gdp', builderSpec: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  container?.remove()
  container = null
  useAppStore.setState({ selectedDataset: null, builderSpec: null })
})

describe('Builder — interacción con esquema real', () => {
  it('carga el esquema, preselecciona la ficha y aplica un preset', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(Builder))

    // El esquema llega y las dimensiones se pintan.
    await vi.waitFor(
      () => expect(container!.textContent).toContain('Estimación previa'),
      { timeout: 15000, interval: 100 },
    )

    // La ficha manda: unit arranca en CP_MEUR (no en la primera unidad).
    const unitChecked = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-dim="unit"]:checked',
    )
    expect(unitChecked?.value).toBe('CP_MEUR')

    // Estimación inicial segura: 10 celdas.
    expect(container.textContent).toContain('10')

    // Preset «España y vecinos»: geo pasa a ES/FR/PT/IT (+AD si existe).
    const presetButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('España y vecinos'),
    )
    expect(presetButton).toBeDefined()
    presetButton!.click()
    await vi.waitFor(
      () => {
        const geos = [
          ...container!.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"][data-dim="geo"]:checked',
          ),
        ].map((i) => i.value)
        expect(geos).toEqual(expect.arrayContaining(['ES', 'FR', 'PT', 'IT']))
        expect(geos.length).toBeLessThanOrEqual(5)
      },
      { timeout: 10000, interval: 100 },
    )

    // Aplicar guarda la PivotSpec en el store.
    const applyButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Usar esta configuración'),
    )
    applyButton!.click()
    await vi.waitFor(
      () => expect(useAppStore.getState().builderSpec).not.toBeNull(),
      { timeout: 10000, interval: 100 },
    )
    const spec = useAppStore.getState().builderSpec!
    expect(spec.dataset).toBe('nama_10_gdp')
    expect(spec.filters['unit']).toEqual(['CP_MEUR'])
    expect(spec.filters['geo']).toEqual(expect.arrayContaining(['ES', 'FR']))

    root.unmount()
  }, 30000)
})
