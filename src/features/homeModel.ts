import { CURATED_PACK } from '../config/curatedPack'
import { THEMES } from '../config/themes'
import type { CatalogueIndex } from '../services/catalogueService'
import { getByCode } from '../services/catalogueService'
import type { DatasetCard } from '../core/types'

/**
 * EUROPIVOT — Modelo de la Home (T07). Funciones puras sobre el índice
 * del catálogo y el pack: la UI solo pinta lo que sale de aquí.
 *
 * RF-22: las fechas «actualizado» de las tarjetas salen de los
 * METADATOS (índice del TOC), nunca de sondear datos.
 */

export interface TopTheme {
  /** Nombre oficial de la carpeta nivel-1 del TOC (inglés). */
  name: string
  count: number
  /** Etiqueta ES si la conocemos; si no, queda el nombre oficial EN. */
  labelEs: string
}

/**
 * Temas reales del catálogo: son las carpetas de nivel 1 del TOC
 * (11: los 9 grandes temas + «EU policies» y «Cross cutting topics»).
 * La navegación refleja el catálogo real, no una lista imaginada.
 */
export function topThemes(index: CatalogueIndex): TopTheme[] {
  const counts = new Map<string, number>()
  for (const entry of index.entries) {
    const top = entry.theme[0]
    if (!top) continue
    counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      labelEs: THEMES.find((th) => th.en === name || th.en.startsWith(name))?.es ?? name,
    }))
    .sort((a, b) => b.count - a.count)
}

export interface PackCardView extends DatasetCard {
  /** Última actualización según metadatos del TOC (RF-22). */
  updatedMeta?: string
  dataStart?: string
  dataEnd?: string
  values?: number
}

/** Une cada ficha del pack con sus metadatos del índice (por código). */
export function packCardsWithMetadata(index: CatalogueIndex | null): PackCardView[] {
  return CURATED_PACK.map((card) => {
    if (!index) return { ...card }
    const meta = getByCode(index, card.code)
    if (!meta) return { ...card }
    return {
      ...card,
      updatedMeta: meta.lastUpdate,
      dataStart: meta.dataStart,
      dataEnd: meta.dataEnd,
      values: meta.values,
    }
  })
}

/** Fecha ISO → «22 oct 2026» en español, sin librerías. */
export function fmtDateEs(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}
