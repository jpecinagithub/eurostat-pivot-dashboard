import { describe, expect, it } from 'vitest'
import { CURATED_PACK } from '../config/curatedPack'
import { parseJsonStat } from '../services/jsonstatParser'
import demoFixture from '../services/__fixtures__/demo_r_d3dens.country.2020-2024.json'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'
import type { ValidOps } from '../core/types'
import {
  LABEL_SIMPLE_MEAN,
  aggregate,
  cagr,
  deltas,
  index100,
  officialReference,
  rankingAtPeriod,
  summarySentence,
} from './derivedMetrics'
import { pivot } from './pivotEngine'

const card = (code: string) => CURATED_PACK.find((c) => c.code === code)!
const uneOps = card('une_rt_m').validOps['PC_ACT'] as ValidOps
const gdpOps = card('nama_10_gdp').validOps['CP_MEUR'] as ValidOps
const densOps = card('demo_r_d3dens').validOps['PER_KM2'] as ValidOps

describe('RF-32 caso 1 — sumar tasas de paro está prohibido y se ofrece la media rotulada', () => {
  it('aggregate(sum) sobre la tasa de paro → no se calcula, con motivo de la ficha', () => {
    const res = aggregate([10.5, 5.2, 6.1], 'sum', uneOps)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('Sumar porcentajes')
  })

  it('aggregate(mean) sí, y su etiqueta dice que NO es el agregado oficial', () => {
    const res = aggregate([10, 20, null], 'mean', uneOps)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.value).toBe(15)
      expect(res.value.label).toBe(LABEL_SIMPLE_MEAN)
      expect(res.value.excludedMissing).toBe(1)
    }
  })

  it('sumar niveles sí está permitido (PIB en euros)', () => {
    const res = aggregate([100, 50], 'sum', gdpOps)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.value).toBe(150)
  })
})

describe('RF-32 caso 2 — de 5 % a 6 %: +1 punto porcentual y +20 % son cosas distintas', () => {
  it('deltas devuelve deltaPp=1 y deltaPct=20 en campos separados', () => {
    const steps = deltas(
      [
        { period: '2023', value: 5 },
        { period: '2024', value: 6 },
      ],
      uneOps,
    )
    expect(steps).toHaveLength(1)
    expect(steps[0].deltaPp).toBe(1)
    expect(steps[0].deltaPct).toBeCloseTo(20, 10)
  })

  it('con una unidad de nivel no hay deltaPp (no se inventa)', () => {
    const steps = deltas(
      [
        { period: '2023', value: 100 },
        { period: '2024', value: 110 },
      ],
      gdpOps,
    )
    expect(steps[0].deltaPp).toBeUndefined()
    expect(steps[0].deltaPct).toBeCloseTo(10, 10)
  })
})

describe('RF-32 caso 3 — ranking con periodo común y excluidos nombrados', () => {
  const demo = parseJsonStat(demoFixture, 'demo_r_d3dens')
  const table = pivot(demo.rows, demo.schema, { rows: ['geo'], columns: ['time'] })

  it('en 2024 Reino Unido queda excluido A LA VISTA (sin dato desde 2021)', () => {
    const res = rankingAtPeriod(table, '2024', densOps)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.excluded).toContain('UK')
      const es = res.value.ranked.find((r) => r.key === 'ES')
      expect(es?.value).toBe(97.2)
      expect(res.value.ranked[0].rank).toBe(1)
      // Todo el ranking comparte el mismo periodo (RF-33).
      expect(res.value.period).toBe('2024')
    }
  })
})

describe('RF-32 caso 4 — índice base 100 con base ausente o cero: no se calcula', () => {
  const series = [
    { period: '2020', value: null },
    { period: '2021', value: 50 },
    { period: '2022', value: 75 },
  ]
  it('base sin dato → motivo que sugiere otro periodo base', () => {
    const res = index100(series, '2020', gdpOps)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('elige otro periodo base')
  })
  it('base cero → tampoco', () => {
    const res = index100([{ period: '2020', value: 0 }, ...series.slice(1)], '2020', gdpOps)
    expect(res.ok).toBe(false)
  })
  it('base válida → 2021=100, 2022=150, ausentes quedan ausentes', () => {
    const res = index100(series, '2021', gdpOps)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value[0].value).toBeNull()
      expect(res.value[1].value).toBe(100)
      expect(res.value[2].value).toBe(150)
    }
  })
})

describe('CAGR y referencia oficial con datos reales (nama_10_gdp)', () => {
  const nama = parseJsonStat(namaFixture, 'nama_10_gdp')
  const table = pivot(nama.rows, nama.schema, { rows: ['geo'], columns: ['time'] })
  const esIdx = table.rowKeys.findIndex((k) => k[0] === 'ES')
  const esSeries = table.colKeys.map((ck, j) => ({
    period: ck[0],
    value: table.cells[esIdx][j].value,
  }))

  it('CAGR de España 2023→2025 coincide con la fórmula sobre los valores de la fixture', () => {
    const res = cagr(esSeries, gdpOps)
    expect(res.ok).toBe(true)
    if (res.ok) {
      const expected =
        (Math.pow(esSeries[2].value! / esSeries[0].value!, 1 / 2) - 1) * 100
      expect(res.value).toBeCloseTo(expected, 8)
      expect(res.value).toBeGreaterThan(5)
      expect(res.value).toBeLessThan(8)
    }
  })

  it('el CAGR está desactivado para tasas (ficha de paro)', () => {
    expect(cagr(esSeries, uneOps).ok).toBe(false)
  })

  it('la referencia oficial se extrae de la tabla y se etiqueta como agregado oficial', () => {
    // La fixture nama solo trae DE/ES/FR: no hay fila UE → null honesto.
    expect(officialReference(table)).toBeNull()
  })
})

describe('RF-29 — frase-resumen: pp y % separados, etiquetas honestas, sin causalidad', () => {
  it('frase completa con referencia oficial y media simple rotulada', () => {
    const sentence = summarySentence({
      subject: 'La tasa de paro de España',
      unitLabel: '% de la población activa',
      series: [
        { period: '2023', value: 5 },
        { period: '2024', value: 6 },
      ],
      ops: uneOps,
      reference: { value: 5.5, period: '2024' },
      panelMean: { value: 5.8, period: '2024' },
    })
    expect(sentence).toContain('fue de 6 % de la población activa en 2024')
    expect(sentence).toContain('+1 puntos porcentuales desde 2023')
    expect(sentence).toContain('+20 % en el periodo')
    expect(sentence).toContain('agregado oficial de la UE')
    expect(sentence).toContain('media simple calculada por EUROPIVOT (sin ponderar)')
    // Nunca causalidad ni juicios.
    expect(sentence).not.toMatch(/debido|gracias|por culpa|mejor|peor/i)
  })

  it('sin datos no hay frase (null), no una frase vacía', () => {
    expect(
      summarySentence({
        subject: 'X',
        unitLabel: '%',
        series: [{ period: '2024', value: null }],
        ops: uneOps,
      }),
    ).toBeNull()
  })
})
