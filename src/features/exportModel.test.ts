import { describe, expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import { parseJsonStat } from '../services/jsonstatParser'
import { pivot } from '../engine/pivotEngine'
import { geoLabelEs } from '../config/labelsEs'
import {
  buildWorkbook,
  gridToDelimited,
  labelledGrid,
  metadataLines,
  tidyToDelimited,
  type ExportContext,
} from './exportModel'
import namaFixture from '../services/__fixtures__/nama_10_gdp.b1gq_cpmeur.2023-2025.json'

/**
 * T12 / RF-21 — el export es una foto fija citable: cita de Eurostat,
 * fecha de exportación y `updated` del dataset DENTRO del fichero;
 * Excel con hojas «Datos» y «Pivot»; derivados rotulados (RF-28).
 */

const parsed = parseJsonStat(namaFixture, 'nama_10_gdp')
const table = pivot(parsed.rows, parsed.schema, { rows: ['geo'], columns: ['time'] })
const grid = labelledGrid(table, (dims, tuple) =>
  tuple.map((code, i) => (dims[i] === 'geo' ? (geoLabelEs(code) ?? code) : code)).join(' · '),
)

const CTX: ExportContext = {
  dataset: 'nama_10_gdp',
  title: 'PIB y componentes principales',
  unitLabel: 'CP_MEUR',
  exportedAt: new Date('2026-11-05T12:00:00.000Z'),
  updated: parsed.meta.updated,
  statusLabels: parsed.meta.statusLabels,
  sentence: 'En 2025, España registró 1.690.012.',
  meanLast: { value: 424998.5, n: 3 },
  lastPeriod: '2025',
}

describe('Exportación (RF-21)', () => {
  it('los metadatos llevan cita, fecha de exportación y updated', () => {
    const lines = metadataLines(CTX)
    expect(lines[0]).toContain('Fuente: Eurostat, nama_10_gdp')
    expect(lines.join('\n')).toContain('Exportado: 2026-11-05T12:00:00.000Z')
    expect(lines.join('\n')).toContain('Datos actualizados por Eurostat:')
    expect(lines.join('\n')).toContain('Unidad: CP_MEUR')
  })

  it('CSV tidy: metadatos con #, cabecera y el valor dorado con su marca', () => {
    const csv = tidyToDelimited(parsed.rows, ['freq', 'unit', 'na_item', 'geo', 'time'], CTX)
    expect(csv).toContain('# Fuente: Eurostat, nama_10_gdp')
    expect(csv).toContain('freq,unit,na_item,geo,time,valor,marca')
    expect(csv).toContain('A,CP_MEUR,B1GQ,ES,2025,1690012,p')
  })

  it('TSV tidy: mismo contenido con tabuladores', () => {
    const tsv = tidyToDelimited(parsed.rows, ['geo', 'time'], CTX, '\t')
    expect(tsv).toContain('geo\ttime\tvalor\tmarca')
    expect(tsv).toContain('ES\t2025\t1690012\tp')
  })

  it('CSV de la tabla visible: etiquetas legibles y derivados rotulados', () => {
    const csv = gridToDelimited(grid, CTX)
    expect(csv).toContain('España')
    expect(csv).toContain('1690012')
    expect(csv).toContain('# Resumen: En 2025, España registró 1.690.012.')
    expect(csv).toContain('Media simple calculada por EUROPIVOT (sin ponderar)')
    expect(csv).toContain('Marca: España · 2025 = «p»')
  })

  it('Excel: hojas «Datos» y «Pivot», valores numéricos y cita dentro', async () => {
    const blob = await buildWorkbook(
      parsed.rows,
      ['freq', 'unit', 'na_item', 'geo', 'time'],
      grid,
      CTX,
    )
    const wb = new Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Datos', 'Pivot'])
    const datos = wb.getWorksheet('Datos')!
    const texts: string[] = []
    datos.eachRow((row) => {
      row.eachCell((cell) => texts.push(String(cell.value ?? '')))
    })
    expect(texts.join(' ')).toContain('Fuente: Eurostat, nama_10_gdp')
    expect(texts).toContain('1690012')
    const pivotSheet = wb.getWorksheet('Pivot')!
    const pTexts: string[] = []
    pivotSheet.eachRow((row) => {
      row.eachCell((cell) => pTexts.push(String(cell.value ?? '')))
    })
    expect(pTexts).toContain('España')
    expect(pTexts.join(' ')).toContain('Media simple calculada por EUROPIVOT')
  })
})
