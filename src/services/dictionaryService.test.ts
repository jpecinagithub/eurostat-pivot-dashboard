import { beforeEach, describe, expect, it } from 'vitest'
import { CURATED_PACK } from '../config/curatedPack'
import { categoryLabelEs, dimLabelEs, geoLabelEs } from '../config/labelsEs'
import { GEO_PRESETS } from '../config/geoPresets'
import {
  _resetDictionaryGaps,
  dictionaryGaps,
  resolveCategoryLabel,
} from './dictionaryService'

/**
 * T14 — cobertura del pack: todo lo que una ficha pone por defecto
 * (unidad, indicador y defaults por dimensión) y todo título de
 * dimensión del pack resuelven en español. Fuera del pack, la cadena
 * degrada a nombre oficial EN y el hueco queda registrado.
 */

beforeEach(() => _resetDictionaryGaps())

describe('Cobertura ES del pack curado', () => {
  it('toda defaultUnit de las 33 fichas tiene etiqueta ES', () => {
    const missing: string[] = []
    for (const card of CURATED_PACK) {
      if (card.defaultUnit && !categoryLabelEs('unit', card.defaultUnit)) {
        missing.push(`${card.code}:unit=${card.defaultUnit}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('todo defaultIndicator de las fichas tiene etiqueta ES', () => {
    const missing: string[] = []
    for (const card of CURATED_PACK) {
      if (
        card.defaultIndicator &&
        !categoryLabelEs('na_item', card.defaultIndicator) &&
        !categoryLabelEs('indic_is', card.defaultIndicator) &&
        !categoryLabelEs('age', card.defaultIndicator)
      ) {
        missing.push(`${card.code}:indicador=${card.defaultIndicator}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('todo valor de «defaults» por dimensión tiene etiqueta ES', () => {
    const missing: string[] = []
    for (const card of CURATED_PACK) {
      for (const [dim, code] of Object.entries(card.defaults ?? {})) {
        if (!categoryLabelEs(dim, code)) missing.push(`${card.code}:${dim}=${code}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('toda dimensión declarada en las fichas tiene título ES', () => {
    const missing: string[] = []
    for (const card of CURATED_PACK) {
      for (const dim of card.dims ?? []) {
        if (dimLabelEs(dim.id) === dim.id) missing.push(`${card.code}:${dim.id}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('los 27 países UE y los agregados habituales tienen nombre ES', () => {
    const eu27 = GEO_PRESETS.find((p) => p.id === 'eu27')
    expect(eu27?.codes).toHaveLength(27)
    for (const code of eu27?.codes ?? []) {
      expect(geoLabelEs(code), code).toBeDefined()
    }
    for (const code of ['EU27_2020', 'EA21', 'EA20', 'ES', 'FR', 'DE', 'PT', 'IT', 'AD']) {
      expect(geoLabelEs(code), code).toBeDefined()
    }
  })
})

describe('Cadena de resolución y registro de huecos', () => {
  it('ES primero; oficial EN después; código al final', () => {
    expect(resolveCategoryLabel({ dim: 'unit', code: 'CP_MEUR' })).toEqual({
      label: 'Precios corrientes, millones de euros',
      source: 'es',
    })
    expect(
      resolveCategoryLabel({ dim: 'na_item', code: 'X_UNKNOWN', official: 'Some official name' }),
    ).toEqual({ label: 'Some official name', source: 'official' })
    expect(resolveCategoryLabel({ dim: 'na_item', code: 'X_UNKNOWN' })).toEqual({
      label: 'X_UNKNOWN',
      source: 'code',
    })
  })

  it('el hueco se registra solo para datasets del pack', () => {
    resolveCategoryLabel({ dataset: 'nama_10_gdp', dim: 'na_item', code: 'X_UNKNOWN' })
    resolveCategoryLabel({ dataset: 'dataset_fuera_del_pack', dim: 'na_item', code: 'Y_UNKNOWN' })
    const gaps = dictionaryGaps()
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ dataset: 'nama_10_gdp', dim: 'na_item', code: 'X_UNKNOWN' })
  })

  it('los nombres regionales NUTS (nombres propios) no cuentan como hueco', () => {
    const r = resolveCategoryLabel({
      dataset: 'nama_10r_2gdp',
      dim: 'geo',
      code: 'ES11',
      official: 'Galicia',
    })
    expect(r).toEqual({ label: 'Galicia', source: 'official' })
    expect(dictionaryGaps()).toHaveLength(0)
  })
})
