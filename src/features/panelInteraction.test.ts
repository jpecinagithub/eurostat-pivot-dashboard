// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Panel from '../components/Panel'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import { _resetGeoCacheForTests } from '../services/geoService'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'

/**
 * Smoke del panel (T09) con la fixture REAL de nama_10_gdp servida por
 * un fetch simulado: tabla con el valor dorado de España, flag con su
 * texto oficial, contexto RF-31, media rotulada — y la prueba de C4:
 * transponer NO vuelve a llamar a la red (fetch llamado 1 sola vez).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const GEOJSON_TINY = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { NUTS_ID: 'ES', NAME_LATN: 'España' },
      geometry: { type: 'Polygon', coordinates: [[[-9, 36], [3, 36], [3, 44], [-9, 44], [-9, 36]]] },
    },
    {
      type: 'Feature',
      properties: { NUTS_ID: 'FR', NAME_LATN: 'France' },
      geometry: { type: 'Polygon', coordinates: [[[0, 42], [8, 42], [8, 51], [0, 51], [0, 42]]] },
    },
    {
      type: 'Feature',
      properties: { NUTS_ID: 'DE', NAME_LATN: 'Deutschland' },
      geometry: { type: 'Polygon', coordinates: [[[6, 47], [14, 47], [14, 55], [6, 55], [6, 47]]] },
    },
  ],
}

const fetchMock = vi.fn(async (url: string) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(namaFixture),
  json: async () => (String(url).includes('gisco') ? GEOJSON_TINY : namaFixture),
}))

const dataCalls = () =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes('/statistics/')).length

let container: HTMLDivElement | null = null

beforeEach(() => {
  _resetQueuesForTests()
  _resetGeoCacheForTests()
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

    expect(dataCalls()).toBe(1)

    // El mapa (T10) pinta con las geometrías GISCO simuladas: España
    // coloreada con su valor de 2025 en el título del path y el aviso
    // de geometrías visible; la geometría NO es una descarga de datos.
    await vi.waitFor(() => expect(container!.textContent).toContain('GISCO'), {
      timeout: 15000,
      interval: 100,
    })
    const paths = [...container!.querySelectorAll('path')]
    const esPath = paths.find((p) => p.querySelector('title')?.textContent?.includes('España'))
    expect(esPath).toBeDefined()
    expect(esPath!.querySelector('title')!.textContent).toContain('1.690.012')
    expect(dataCalls()).toBe(1)

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
    expect(dataCalls()).toBe(1)

    root.unmount()
  }, 30000)
})
