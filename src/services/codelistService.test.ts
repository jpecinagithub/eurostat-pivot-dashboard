// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseCodelist } from './codelistService'
import { buildSchema } from './schemaService'
import geoSample from './__fixtures__/codelist_geo.sample.xml?raw'
import unitSample from './__fixtures__/codelist_unit.sample.xml?raw'
import dsdXml from './__fixtures__/nama_10_gdp.datastructure.xml?raw'
import constraintXml from './__fixtures__/nama_10_gdp.contentconstraint.xml?raw'

describe('Codelist Service — nombres oficiales (fix etiquetas)', () => {
  it('parsea code → nombre EN desde la codelist SDMX', () => {
    const geo = parseCodelist(geoSample)
    expect(geo.get('ES')).toBe('Spain')
    expect(geo.get('EU27_2020')).toContain('European Union')
    const unit = parseCodelist(unitSample)
    expect(unit.get('CP_PPS_EU27_2020_HAB')).toBe(
      'Current prices, purchasing power standard (PPS, EU27 from 2020) per capita',
    )
    expect(unit.get('CP_MEUR')).toContain('million euro')
  })

  it('el DSD declara la codelist de cada dimensión y el esquema la conserva', () => {
    const schema = buildSchema('nama_10_gdp', dsdXml, constraintXml)
    const byId = Object.fromEntries(schema.dims.map((d) => [d.id, d.codelist]))
    expect(byId['unit']).toBe('UNIT')
    expect(byId['na_item']).toBe('NA_ITEM')
    expect(byId['geo']).toBe('GEO')
    expect(byId['freq']).toBe('FREQ')
  })
})
