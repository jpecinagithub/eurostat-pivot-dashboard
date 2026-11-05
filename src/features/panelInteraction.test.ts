// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from '../components/Panel'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'

/**
 * Smoke del panel (T09) con la fixture REAL de nama_10_gdp servida por
 * un fetch simulado: tabla con el valor dorado de España, flag con su
 * texto oficial, contexto RF-31, media rotulada — y la prueba de C4:
 * transponer NO vuelve a llamar a la red (fetch llamado 1 sola vez).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(namaFixture),
}))

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  useAppStore.setState({
    builderSpec: {
      dataset: 'nama_10_gdp',
      lang: 'EN',
      filters: { unit: ['CP_MEUR'], na_item: ['B1GQ'], geo: ['DE', 'ES', 'FR'] },
      time: { mode: 'values', values: ['2023', '2024', '2025'] },
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

describe('Panel — pipeline completo con fixture real', () => {
  it('pinta tabla, contexto y media rotulada; transponer no re-descarga', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(Panel))

    await vi.waitFor(() => expect(container!.textContent).toContain('1.690.012'), {
      timeout: 15000,
      interval: 100,
    })

    // Contexto RF-31: unidad, actualizado (de la respuesta) y fuente.
    expect(container.textContent).toContain('CP_MEUR')
    expect(container.textContent).toContain('Actualizado')
    expect(container.textContent).toContain('2026')
    expect(container.textContent).toContain('Eurostat')
    // La flag p trae su texto oficial de la propia respuesta (C8).
    expect(container.innerHTML).toContain('provisional')
    // Media simple rotulada (RF-28) en el último periodo.
    expect(container.textContent).toContain(
      'Media simple calculada por EUROPIVOT (sin ponderar) — no es el agregado oficial',
    )
    // La fixture no trae fila UE → no se finge referencia oficial.
    expect(container.textContent).not.toContain('Agregado oficial de la UE (2025)')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Transponer: repivotar desde las mismas filas, CERO red nueva.
    const transpose = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Transponer'),
    )
    expect(transpose).toBeDefined()
    transpose!.click()
    await vi.waitFor(() => expect(container!.textContent).toContain('2023'), {
      timeout: 10000,
      interval: 100,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    root.unmount()
  }, 30000)
})
