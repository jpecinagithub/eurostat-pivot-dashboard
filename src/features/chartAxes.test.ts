// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { niceTicks } from '../components/Panel'

describe('Ejes del gráfico (feedback de Jon: «no aparecen los ejes»)', () => {
  it('ticks bonitos que cubren el rango de la captura (pobreza 22,1–32,8)', () => {
    const { lo, hi, ticks } = niceTicks(22.1, 32.8)
    expect(lo).toBeLessThanOrEqual(22.1)
    expect(hi).toBeGreaterThanOrEqual(32.8)
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    expect(ticks[0]).toBe(lo)
    expect(ticks[ticks.length - 1]).toBe(hi)
  })

  it('rangos grandes (PIB per cápita) y constantes no rompen', () => {
    const big = niceTicks(26145, 48621.8)
    expect(big.lo).toBeLessThanOrEqual(26145)
    expect(big.hi).toBeGreaterThanOrEqual(48621.8)
    const flat = niceTicks(5, 5)
    expect(flat.hi).toBeGreaterThan(flat.lo)
    expect(flat.ticks.length).toBeGreaterThanOrEqual(3)
  })
})
