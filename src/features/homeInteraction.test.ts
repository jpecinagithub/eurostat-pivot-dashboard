// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Home from '../components/Home'

/**
 * Smoke de interacción de la Home (T07) con el índice REAL de disco:
 * monta el componente, espera a que cargue el catálogo perezoso y
 * busca «unemployment» como haría un usuario. La E2E completa con
 * navegador llega en T15 (Playwright).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null

afterEach(() => {
  container?.remove()
  container = null
})

describe('Home — interacción real con el índice', () => {
  it('carga temas, busca y encuentra datasets', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(createElement(Home))

    // Los temas aparecen cuando el índice perezoso termina de cargar.
    await vi.waitFor(
      () => {
        expect(container!.textContent).toContain('Población y condiciones sociales')
      },
      { timeout: 20000, interval: 100 },
    )
    expect(container.textContent).toContain('Economía y finanzas')

    // Buscar como un usuario: fijar el valor y disparar el evento input.
    const input = container.querySelector<HTMLInputElement>('#catalogue-search')
    expect(input).not.toBeNull()
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    setter?.call(input, 'unemployment')
    input!.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(
      () => {
        expect(container!.textContent).toContain('Resultados')
        expect(container!.textContent).toContain('une_rt_m')
      },
      { timeout: 10000, interval: 100 },
    )
    root.unmount()
  }, 30000)
})
