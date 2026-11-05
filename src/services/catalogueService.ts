/**
 * EUROPIVOT — Catalogue Service (T04). SDD §4.5 (decisión T00), RF-01.
 *
 * El catálogo NO se pide en vivo: la Catalogue API no envía CORS y el
 * navegador la bloquea (puerta T00). Se consume el índice estático
 * versionado que genera `scripts/build-catalogue-index.mjs` en build.
 * Su fecha (`generatedAt`) viaja con los datos para declararla en la UI:
 * la frescura del catálogo se muestra, no se disimula (C10).
 *
 * Las fechas `lastUpdate` del índice vienen de METADATOS (el TOC), no de
 * sondas de datos — es la regla v2 de RF-01/RF-22.
 */

export interface CatalogueEntry {
  code: string
  title: string
  type: 'dataset' | 'table'
  /** Ruta de carpetas del TOC (tema principal primero), en inglés oficial. */
  theme: string[]
  /** Última actualización de datos según el TOC (ISO), si consta. */
  lastUpdate?: string
  dataStart?: string
  dataEnd?: string
  /** Nº de valores del dataset según el TOC, si consta. */
  values?: number
}

export interface CatalogueIndex {
  version: number
  generatedAt: string
  source: string
  entries: CatalogueEntry[]
}

/** Forma cruda en disco: las rutas de tema van internadas (índice a `themes`). */
interface RawCatalogueIndex {
  version: number
  generatedAt: string
  source: string
  themes: string[][]
  entries: (Omit<CatalogueEntry, 'theme'> & { theme: number })[]
}

/** Carga perezosa: el índice no debe pesar en el primer render. */
export async function loadCatalogueIndex(): Promise<CatalogueIndex> {
  const mod = await import('../config/catalogue-index.json')
  const raw = mod.default as unknown as RawCatalogueIndex
  return {
    version: raw.version,
    generatedAt: raw.generatedAt,
    source: raw.source,
    entries: raw.entries.map((e) => ({
      ...e,
      theme: raw.themes[e.theme] ?? [],
    })),
  }
}

/** Minúsculas y sin diacríticos: «población» encuentra «Population» igual que «poblacion». */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function score(entry: CatalogueEntry, query: string, words: string[]): number | null {
  const code = entry.code.toLowerCase()
  const title = normalizeText(entry.title)
  if (code === query) return 0
  if (code.startsWith(query)) return 1
  if (words.every((w) => title.includes(w))) {
    return title.startsWith(words[0]) ? 2 : 3
  }
  if (words.some((w) => code.includes(w))) return 4
  return null
}

/**
 * Busca por código o por palabras del título (todas las palabras deben
 * aparecer). Ranking: código exacto > prefijo de código > título que
 * empieza por la búsqueda > título que la contiene > código parcial.
 */
export function searchCatalogue(
  index: CatalogueIndex,
  query: string,
  limit = 50,
): CatalogueEntry[] {
  const q = normalizeText(query)
  if (!q) return []
  const words = q.split(/\s+/)
  const hits: { entry: CatalogueEntry; score: number }[] = []
  for (const entry of index.entries) {
    const s = score(entry, q, words)
    if (s !== null) hits.push({ entry, score: s })
  }
  hits.sort(
    (a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title),
  )
  return hits.slice(0, limit).map((h) => h.entry)
}

export function getByCode(index: CatalogueIndex, code: string): CatalogueEntry | undefined {
  const wanted = code.trim().toLowerCase()
  return index.entries.find((e) => e.code.toLowerCase() === wanted)
}

/** Temas de primer nivel con su conteo de datasets/tablas. */
export function listThemes(index: CatalogueIndex): { theme: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const entry of index.entries) {
    const top = entry.theme[0] ?? '—'
    counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
}

export function filterByTheme(index: CatalogueIndex, topTheme: string): CatalogueEntry[] {
  return index.entries.filter((e) => e.theme[0] === topTheme)
}
