import type { PivotSpec } from '../core/types'
import { fetchDataset } from './eurostatClient'

/**
 * Freshness Service (T13; RF-22/23/24, C10).
 *
 * Eurostat NO tiene tiempo real: carga datos dos veces al día, a las
 * 11:00 y 23:00 Europe/Brussels. La frescura se comprueba alineada a
 * ese ciclo y de forma barata: primero la memoria de lo ya visto
 * (registro local del `updated` de cada dataset) y, llegada la
 * ventana, UN probe mínimo presupuestado por dataset (una geografía,
 * un periodo) que solo lee el campo `updated` de la respuesta.
 * Nunca se promete tiempo real y nunca se dispara una batería de
 * consultas al abrir la portada.
 *
 * RF-24: detectar datos nuevos NUNCA aplica el refresco solo —
 * avisa, y el usuario recarga cuando quiere.
 */

export const FRESHNESS_STORAGE_KEY = 'europivot.freshness.v1'

/** Minutos tras la hora de carga para dar margen a Eurostat. */
const WINDOW_MINUTES = [11 * 60 + 5, 23 * 60 + 5]

interface BrusselsParts {
  y: number
  mo: number
  d: number
  h: number
  mi: number
}

function brusselsParts(date: Date): BrusselsParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts: Record<string, number> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  return { y: parts.year, mo: parts.month, d: parts.day, h: parts.hour, mi: parts.minute }
}

/** Convierte una hora de pared de Bruselas a instante UTC (refina el offset). */
function brusselsWallToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  const target = Date.UTC(y, mo - 1, d, h, mi)
  let guess = target
  for (let i = 0; i < 3; i++) {
    const p = brusselsParts(new Date(guess))
    const wallAsUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)
    const diff = target - wallAsUtc
    if (diff === 0) break
    guess += diff
  }
  return new Date(guess)
}

/** Próxima ventana de comprobación (11:05 o 23:05 de Bruselas) tras `from`. */
export function nextBrusselsCheck(from: Date): Date {
  const p = brusselsParts(from)
  const candidates: Date[] = []
  for (const addDays of [0, 1]) {
    const day = new Date(Date.UTC(p.y, p.mo - 1, p.d + addDays))
    for (const mins of WINDOW_MINUTES) {
      candidates.push(
        brusselsWallToUtc(
          day.getUTCFullYear(),
          day.getUTCMonth() + 1,
          day.getUTCDate(),
          Math.floor(mins / 60),
          mins % 60,
        ),
      )
    }
  }
  const future = candidates.filter((c) => c.getTime() > from.getTime()).sort((a, b) => +a - +b)
  return future[0]
}

/** Ventana de carga más reciente anterior a `from` (11:00/23:00 de Bruselas). */
export function lastBrusselsWindow(from: Date): Date {
  const p = brusselsParts(from)
  const candidates: Date[] = []
  for (const addDays of [-1, 0]) {
    const day = new Date(Date.UTC(p.y, p.mo - 1, p.d + addDays))
    for (const hour of [11, 23]) {
      candidates.push(
        brusselsWallToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, 0),
      )
    }
  }
  const past = candidates.filter((c) => c.getTime() <= from.getTime()).sort((a, b) => +b - +a)
  return past[0]
}

// ——— Registro local de `updated` vistos ———

type SeenMap = Record<string, string>

interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function loadSeen(storage: StorageLike | null = defaultStorage()): SeenMap {
  if (!storage) return {}
  try {
    const raw = storage.getItem(FRESHNESS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (e): e is [string, string] => typeof e[1] === 'string',
        ),
      )
    }
  } catch {
    /* registro corrupto = se ignora */
  }
  return {}
}

export function recordSeen(
  dataset: string,
  updated: string | undefined,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage || !updated) return
  try {
    const seen = loadSeen(storage)
    if (seen[dataset] !== updated) {
      seen[dataset] = updated
      storage.setItem(FRESHNESS_STORAGE_KEY, JSON.stringify(seen))
    }
  } catch {
    /* sin almacenamiento no hay registro; no es un error del usuario */
  }
}

/** ¿Es `candidate` posterior a `seen`? (instantes; si no parsean, texto). */
export function isNewer(candidate: string, seen: string): boolean {
  const a = Date.parse(candidate)
  const b = Date.parse(seen)
  if (!Number.isNaN(a) && !Number.isNaN(b)) return a > b
  return candidate > seen
}

// ——— Probe presupuestado (RF-22) ———

/**
 * Spec mínima para leer solo el `updated`: primer valor de cada
 * dimensión del spec del panel y un único periodo. La respuesta es
 * diminuta sea cual sea el dataset.
 */
export function probeSpecFor(spec: PivotSpec): PivotSpec {
  const filters: PivotSpec['filters'] = {}
  for (const [dim, codes] of Object.entries(spec.filters)) {
    if (codes.length > 0) filters[dim] = [codes[0]]
  }
  return {
    dataset: spec.dataset,
    lang: spec.lang,
    filters,
    ...(spec.geoLevel ? { geoLevel: spec.geoLevel } : {}),
    time: { mode: 'last', n: 1 },
    rows: spec.rows,
    columns: spec.columns,
  }
}

/** Lee el `updated` actual del dataset con el probe mínimo. */
export async function probeUpdated(
  spec: PivotSpec,
  fetchImpl?: typeof fetch,
): Promise<string | undefined> {
  const raw = (await fetchDataset(probeSpecFor(spec), fetchImpl ? { fetchImpl } : {})) as
    | { updated?: unknown }
    | undefined
  return typeof raw?.updated === 'string' ? raw.updated : undefined
}
