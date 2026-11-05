import { describe, expect, it } from 'vitest'
import { CURATED_PACK } from './curatedPack'

describe('Pack curado — fichas §3.13 completas (T05b)', () => {
  it('tiene 19 fichas (20 del plan − consolidación IPCA v1→v2) sin códigos repetidos', () => {
    expect(CURATED_PACK).toHaveLength(19)
    expect(new Set(CURATED_PACK.map((c) => c.code)).size).toBe(19)
  })

  it('ninguna ficha es de la familia IPCA v1 discontinuada', () => {
    const codes = CURATED_PACK.map((c) => c.code)
    for (const v1 of ['prc_hicp_midx', 'prc_hicp_aind', 'prc_hicp_manr']) {
      expect(codes).not.toContain(v1)
    }
    expect(codes).toContain('prc_hicp_minr')
    expect(codes).toContain('prc_hicp_ainr')
  })

  it('toda ficha cumple el mínimo de §3.13', () => {
    for (const card of CURATED_PACK) {
      expect(card.titleEs.length, card.code).toBeGreaterThan(3)
      expect(card.status, card.code).toBe('activo')
      expect(card.lastPeriod, card.code).toBeTruthy()
      expect(card.freq, card.code).toMatch(/^[AQM]$/)
      expect(card.verifiedAt, card.code).toBe('2026-11-05')
      expect(card.aggregateNature?.length, card.code).toBeGreaterThan(20)
      expect(card.exampleQuery, card.code).toContain(`/data/${card.code}?`)
      expect(card.exampleQuery, card.code).toContain('lastTimePeriod=1')
      // Dimensiones con geo y time siempre presentes y con rol.
      const geo = card.dims?.find((d) => d.id === 'geo')
      const time = card.dims?.find((d) => d.id === 'time')
      expect(geo?.role, card.code).toBe('geo')
      expect(time?.role, card.code).toBe('time')
      // validOps no vacío, y la unidad por defecto (si hay) tiene reglas.
      expect(Object.keys(card.validOps).length, card.code).toBeGreaterThan(0)
      if (card.defaultUnit) {
        expect(card.validOps[card.defaultUnit], `${card.code}/${card.defaultUnit}`).toBeDefined()
      }
    }
  })

  it('las reglas C13 clave: porcentajes no se suman; niveles sí', () => {
    const paro = CURATED_PACK.find((c) => c.code === 'une_rt_m')
    expect(paro?.validOps['PC_ACT']?.sum).toBe(false)
    expect(paro?.validOps['PC_ACT']?.deltaPp).toBe(true)
    expect(paro?.validOps['PC_ACT']?.disabledReason).toContain('Sumar porcentajes')
    const pib = CURATED_PACK.find((c) => c.code === 'nama_10_gdp')
    expect(pib?.validOps['CP_MEUR']?.sum).toBe(true)
    expect(pib?.validOps['CP_MEUR']?.deltaPp).toBe(false)
    const ipca = CURATED_PACK.find((c) => c.code === 'prc_hicp_minr')
    // La sucesora de prc_hicp_manr vive como unidad RCH_A dentro de minr.
    expect(ipca?.validOps['RCH_A']).toBeDefined()
    expect(ipca?.aggregateNature).toContain('RCH_A')
  })

  it('la trampa de ilc_li02 queda documentada en su ficha (B_60, no A_60)', () => {
    const li02 = CURATED_PACK.find((c) => c.code === 'ilc_li02')
    expect(li02?.defaultIndicator).toBe('B_60')
    expect(li02?.exampleQuery).toContain('rskpovth=B_60')
    expect(li02?.aggregateNature).toContain('A_60')
  })
})
