import type { TidyRow } from '../core/types'
import { LABEL_OFFICIAL_EU, LABEL_SIMPLE_MEAN, fmtEs } from '../engine/derivedMetrics'
import type { PivotTable } from '../engine/pivotEngine'

/**
 * Exportación (T12, RF-21) — la foto fija citable, en contraste con el
 * enlace (RF-20), que es configuración viva.
 *
 * Todo fichero lleva DENTRO la cita de Eurostat (C12), la unidad, la
 * fecha de exportación y el `updated` del dataset tal como estaba al
 * exportar: si Eurostat revisa después, el fichero no cambia.
 * Los cálculos propios viajan rotulados con las etiquetas de RF-28.
 */

export interface ExportContext {
  dataset: string
  title: string
  unitLabel?: string
  /** Fecha de exportación (la pone quien exporta; inyectable en tests). */
  exportedAt: Date
  /** Campo `updated` de la respuesta JSON-stat, si vino. */
  updated?: string
  statusLabels?: Record<string, string>
  /** Frase-resumen RF-29 del panel, si la hay (materializa derivados). */
  sentence?: string
  meanLast?: { value: number; n: number }
  referenceLast?: { value: number }
  lastPeriod?: string
}

export function exportDateEs(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function metadataLines(ctx: ExportContext): string[] {
  const lines = [
    `Fuente: Eurostat, ${ctx.dataset}, consultado el ${exportDateEs(ctx.exportedAt)}`,
    `Exportado: ${ctx.exportedAt.toISOString()}`,
  ]
  if (ctx.updated) lines.push(`Datos actualizados por Eurostat: ${ctx.updated}`)
  if (ctx.unitLabel) lines.push(`Unidad: ${ctx.unitLabel}`)
  lines.push('Generado con EUROPIVOT (datos de Eurostat)')
  return lines
}

export function fileStem(dataset: string, kind: string, at: Date): string {
  const day = at.toISOString().slice(0, 10)
  return `europivot-${dataset}-${kind}-${day}`
}

function csvEscape(field: string, sep: string): string {
  return field.includes(sep) || field.includes('"') || field.includes('\n')
    ? `"${field.replaceAll('"', '""')}"`
    : field
}

/** Tabla tidy a CSV/TSV: líneas de metadatos con «#», cabecera y filas. */
export function tidyToDelimited(rows: TidyRow[], dimIds: string[], ctx: ExportContext, sep = ','): string {
  const out: string[] = metadataLines(ctx).map((l) => `# ${l}`)
  out.push([...dimIds, 'valor', 'marca'].map((h) => csvEscape(h, sep)).join(sep))
  for (const row of rows) {
    const cells = dimIds.map((d) => csvEscape(String(row[d] ?? ''), sep))
    cells.push(row.value === null || row.value === undefined ? '' : String(row.value))
    cells.push(csvEscape(row.status ?? '', sep))
    out.push(cells.join(sep))
  }
  return out.join('\n') + '\n'
}

/** Rejilla pivot ya rotulada (la que ve el usuario) a CSV/TSV. */
export interface LabelledGrid {
  corner: string
  colLabels: string[]
  rows: { label: string; cells: { value: number | null; status?: string }[] }[]
}

export function gridToDelimited(grid: LabelledGrid, ctx: ExportContext, sep = ','): string {
  const out: string[] = metadataLines(ctx).map((l) => `# ${l}`)
  out.push([grid.corner, ...grid.colLabels].map((h) => csvEscape(h, sep)).join(sep))
  for (const row of grid.rows) {
    const cells = [csvEscape(row.label, sep)]
    for (const cell of row.cells) {
      cells.push(cell.value === null ? '' : String(cell.value))
    }
    out.push(cells.join(sep))
  }
  out.push(...flagNoteLines(grid, ctx).map((l) => `# ${l}`))
  out.push(...derivedNoteLines(ctx).map((l) => `# ${l}`))
  return out.join('\n') + '\n'
}

/** Marcas de estado presentes en la rejilla, con su texto oficial. */
export function flagNoteLines(grid: LabelledGrid, ctx: ExportContext): string[] {
  const lines: string[] = []
  grid.rows.forEach((row) => {
    row.cells.forEach((cell, j) => {
      if (cell.status) {
        const text = ctx.statusLabels?.[cell.status]
        lines.push(
          `Marca: ${row.label} · ${grid.colLabels[j]} = «${cell.status}»${text ? ` (${text})` : ''}`,
        )
      }
    })
  })
  return lines
}

/** Cálculos propios materializados y rotulados (RF-28) para la hoja/notas. */
export function derivedNoteLines(ctx: ExportContext): string[] {
  const lines: string[] = []
  if (ctx.sentence) lines.push(`Resumen: ${ctx.sentence}`)
  if (ctx.meanLast && ctx.lastPeriod) {
    lines.push(
      `${LABEL_SIMPLE_MEAN} (${ctx.lastPeriod}): ${fmtEs(ctx.meanLast.value)} (n=${ctx.meanLast.n})`,
    )
  }
  if (ctx.referenceLast && ctx.lastPeriod) {
    lines.push(`${LABEL_OFFICIAL_EU} (${ctx.lastPeriod}): ${fmtEs(ctx.referenceLast.value)}`)
  }
  return lines
}

/** Descarga un Blob con nombre (solo navegador). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(text: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

/**
 * Excel (.xlsx) con las dos hojas de RF-21: «Datos» (tidy) y «Pivot»
 * (vista actual rotulada + marcas + derivados). ExcelJS se importa en
 * diferido: su peso no lo paga quien no exporta nunca.
 */
export async function buildWorkbook(
  rows: TidyRow[],
  dimIds: string[],
  grid: LabelledGrid,
  ctx: ExportContext,
): Promise<Blob> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = 'EUROPIVOT'
  wb.created = ctx.exportedAt

  const meta = metadataLines(ctx)
  const datos = wb.addWorksheet('Datos')
  for (const line of meta) datos.addRow([line])
  datos.addRow([])
  datos.addRow([...dimIds, 'valor', 'marca'])
  for (const row of rows) {
    datos.addRow([
      ...dimIds.map((d) => String(row[d] ?? '')),
      row.value ?? null,
      row.status ?? '',
    ])
  }

  const pivot = wb.addWorksheet('Pivot')
  for (const line of meta) pivot.addRow([line])
  pivot.addRow([ctx.title])
  pivot.addRow([])
  pivot.addRow([grid.corner, ...grid.colLabels])
  for (const row of grid.rows) {
    pivot.addRow([row.label, ...row.cells.map((c) => c.value)])
  }
  pivot.addRow([])
  for (const line of [...flagNoteLines(grid, ctx), ...derivedNoteLines(ctx)]) {
    pivot.addRow([line])
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * PNG de un SVG en pantalla (gráfico o mapa): lo serializa sobre un
 * lienzo con el fondo del tema Atlas a 2× y lo descarga.
 */
export async function svgToPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const box = svg.getBoundingClientRect()
  const width = Math.max(320, Math.round(box.width))
  const height = Math.max(200, Math.round(box.height))
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const text = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  const svgUrl = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg-load'))
      img.src = svgUrl
    })
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const g = canvas.getContext('2d')
    if (!g) return
    g.fillStyle = '#090c16'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (blob) downloadBlob(blob, filename)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** Rejilla rotulada desde la tabla pivot del panel (etiquetas del UI). */
export function labelledGrid(
  table: PivotTable,
  labelOf: (dims: string[], tuple: string[]) => string,
): LabelledGrid {
  return {
    corner: table.rowDims.join(' × '),
    colLabels: table.colKeys.map((tuple) => labelOf(table.colDims, tuple)),
    rows: table.rowKeys.map((tuple, i) => ({
      label: labelOf(table.rowDims, tuple),
      cells: table.cells[i].map((c) => ({ value: c.value, status: c.status })),
    })),
  }
}
