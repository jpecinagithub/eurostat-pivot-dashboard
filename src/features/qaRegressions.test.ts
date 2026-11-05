// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Builder from '../components/Builder'
import Panel from '../components/Panel'
import { useAppStore } from '../store/dashboardStore'
import { _resetQueuesForTests } from '../services/eurostatClient'
import { M1_SPEC } from './panelUrlCodec'
import dsdXml from '../services/__fixtures__/nama_10_gdp.datastructure.xml?raw'
import constraintXml from '../services/__fixtures__/nama_10_gdp.contentconstraint.xml?raw'
import geoSample from '../services/__fixtures__/codelist_geo.sample.xml?raw'
import unitSample from '../services/__fixtures__/codelist_unit.sample.xml?raw'
import naItemSample from '../services/__fixtures__/codelist_na_item.sample.xml?raw'

/**
 * Regresiones de la QA de Jon (2026-11-05):
 * - El constructor ofrece «Reintentar» cuando la carga del esquema
 *   falla, y el reintento abre el constructor sin recargar la página.
 * - Una descarga de datos colgada tiene salida visible: «Cancelar»
 *   la detiene y el error ofrece «Reintentar» (el límite de 30 s usa
 *   el mismo camino de aborto).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

function mount(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(node)
}

async function waitText(text: string) {
  await vi.waitFor(() => expect(container!.textContent).toContain(text), {
    timeout: 15000,
    interval: 80,
  })
}

function clickButton(text: string) {
  const btn = [...container!.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  )
  expect(btn, `botón «${text}»`).toBeTruthy()
  btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  _resetQueuesForTests()
  useAppStore.setState({
    dashboard: null,
    dashboardShared: false,
    builderSpec: null,
    selectedDataset: null,
    builderScrollSignal: 0,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  root?.unmount()
  root = null
  container?.remove()
  container = null
})

describe('QA — constructor con reintento de esquema', () => {
  it('falla la primera carga, «Reintentar» la repite y abre el constructor', async () => {
    let dsdCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url)
        if (u.includes('datastructure')) {
          dsdCalls += 1
          if (dsdCalls === 1) {
            // Corte de red como el de la QA: fetch RECHAZA.
            throw new TypeError('Failed to fetch')
          }
          return { ok: true, status: 200, text: async () => dsdXml }
        }
        if (u.includes('contentconstraint')) {
          return { ok: true, status: 200, text: async () => constraintXml }
        }
        if (u.includes('codelist')) {
          const body = u.includes('GEO')
            ? geoSample
            : u.includes('NA_ITEM')
              ? naItemSample
              : unitSample
          return { ok: true, status: 200, text: async () => body }
        }
        return { ok: true, status: 200, text: async () => '{}' }
      }),
    )
    useAppStore.setState({ selectedDataset: 'nama_10_gdp' })
    mount(createElement(Builder))

    await waitText('No se pudo cargar el esquema del dataset.')
    clickButton('Reintentar')
    await waitText('Usar esta configuración')
    expect(dsdCalls).toBe(2)
  }, 30000)
})

describe('QA — descarga de panel con salida visible', () => {
  it('«Cancelar» detiene una descarga colgada y el error ofrece reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, opts?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          }),
      ),
    )
    useAppStore.setState({ builderSpec: M1_SPEC })
    mount(createElement(Panel))

    await waitText('Descargando datos de Eurostat')
    clickButton('Cancelar')
    await waitText('Descarga cancelada')
    expect(container!.textContent).toContain('Reintentar')
  }, 30000)
})
