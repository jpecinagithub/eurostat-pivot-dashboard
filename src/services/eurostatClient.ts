import type { PivotSpec } from '../core/types'
import { COMEXT_STATISTICS_API_BASE, STATISTICS_API_BASE } from './eurostat'

/**
 * EUROPIVOT — Eurostat Client (T02). SDD §2.2, RF-08/10/11, C6.
 *
 * Responsabilidades, y solo estas:
 *  1. buildQuery: PivotSpec → URL canónica de la Statistics API.
 *  2. Errores tipados: distinguir «sin datos» de «error», y dentro de 413,
 *     «en preparación» (asíncrono) de «demasiado grande» (RF-10 v2).
 *  3. fetchDataset: extracción serializada por dataset (máx. 1 en vuelo
 *     por dataset, C6 fair use). El parseo JSON-stat es T03; la caché
 *     por URL canónica y el presupuesto de celdas son T05/TanStack.
 */

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export type EurostatErrorKind =
  | 'no_results' // fault 100 — selección vacía, NO es un error de red (RF-11)
  | 'syntax' // fault 140
  | 'semantic' // fault 150 (p. ej. geo + geoLevel)
  | 'too_big' // 413 EXTRACTION_TOO_BIG (>5M estimadas)
  | 'in_preparation' // 413 asíncrono: Eurostat la prepara en segundo plano (500k–5M)
  | 'server' // 500 y resto de 5xx
  | 'http' // otro HTTP no clasificado
  | 'network' // fetch rechazado (sin respuesta)
  | 'invalid_spec' // la PivotSpec viola el contrato antes de salir (cliente)

export class EurostatApiError extends Error {
  readonly kind: EurostatErrorKind
  readonly fault?: number
  readonly httpStatus?: number
  /** Clave de la extracción asíncrona, si el servidor la devolvió. */
  readonly asyncKey?: string

  constructor(
    kind: EurostatErrorKind,
    message: string,
    opts: { fault?: number; httpStatus?: number; asyncKey?: string } = {},
  ) {
    super(message)
    this.name = 'EurostatApiError'
    this.kind = kind
    this.fault = opts.fault
    this.httpStatus = opts.httpStatus
    this.asyncKey = opts.asyncKey
  }
}

// ---------------------------------------------------------------------------
// buildQuery
// ---------------------------------------------------------------------------

/** Base según el dataset: los DS- (Comext/Prodcom) van a su propio host (§2.1). */
export function apiBaseFor(dataset: string): string {
  return dataset.toUpperCase().startsWith('DS-')
    ? COMEXT_STATISTICS_API_BASE
    : STATISTICS_API_BASE
}

/**
 * Construye la URL canónica. Orden de parámetros determinista (formato,
 * idioma, dimensiones ordenadas, geoLevel, tiempo) para que la misma
 * selección produzca siempre la misma URL = misma clave de caché.
 *
 * Reglas del contrato §2.2 que se hacen cumplir aquí:
 *  - Un solo modo temporal por consulta (el tipo TimeSelection ya lo impone).
 *  - `geoLevel` es excluyente con el filtro `geo` (si van juntos, la API
 *    devuelve fault 150; lo detectamos en cliente como 'invalid_spec').
 *  - La dimensión `time` no va en `filters`: la gobierna `spec.time`.
 */
export function buildQuery(spec: PivotSpec): string {
  const dataset = spec.dataset.trim()
  if (!dataset) {
    throw new EurostatApiError('invalid_spec', 'La PivotSpec no tiene dataset.')
  }

  const geoFilter = spec.filters['geo'] ?? []
  if (spec.geoLevel && geoFilter.length > 0) {
    throw new EurostatApiError(
      'invalid_spec',
      'geoLevel y el filtro geo son excluyentes (la API devolvería fault 150). Elige nivel o países, no ambos.',
    )
  }

  const params = new URLSearchParams()
  params.set('format', 'JSON')
  params.set('lang', spec.lang)

  const dimIds = Object.keys(spec.filters)
    .filter((dim) => dim !== 'time')
    .sort()
  for (const dim of dimIds) {
    for (const value of spec.filters[dim]) {
      params.append(dim, value)
    }
  }

  if (spec.geoLevel) params.set('geoLevel', spec.geoLevel)

  switch (spec.time.mode) {
    case 'last': {
      if (!Number.isInteger(spec.time.n) || spec.time.n < 1) {
        throw new EurostatApiError(
          'invalid_spec',
          `lastTimePeriod debe ser un entero ≥ 1 (recibido: ${spec.time.n}).`,
        )
      }
      params.set('lastTimePeriod', String(spec.time.n))
      break
    }
    case 'range': {
      if (!spec.time.since || !spec.time.until || spec.time.since > spec.time.until) {
        throw new EurostatApiError(
          'invalid_spec',
          `Rango temporal inválido: desde «${spec.time.since}» hasta «${spec.time.until}».`,
        )
      }
      params.set('sinceTimePeriod', spec.time.since)
      params.set('untilTimePeriod', spec.time.until)
      break
    }
    case 'values': {
      if (spec.time.values.length === 0) {
        throw new EurostatApiError(
          'invalid_spec',
          'El modo temporal «values» necesita al menos un periodo.',
        )
      }
      for (const value of spec.time.values) params.append('time', value)
      break
    }
  }

  return `${apiBaseFor(dataset)}/${dataset}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Clasificación de respuestas de error
// ---------------------------------------------------------------------------

interface FaultLike {
  fault?: number | string
  label?: string
  status?: number | string
}

/** Extrae fault/label de los cuerpos de error que devuelve Eurostat (JSON o texto). */
function extractFault(bodyText: string): FaultLike {
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>
    const candidates: Record<string, unknown>[] = [body]
    if (body['warning'] && typeof body['warning'] === 'object') {
      candidates.push(body['warning'] as Record<string, unknown>)
    }
    if (body['error'] && typeof body['error'] === 'object') {
      candidates.push(body['error'] as Record<string, unknown>)
    }
    for (const c of candidates) {
      const fault = (c['fault'] ?? c['status']) as number | string | undefined
      const label = (c['label'] ?? c['faultstring'] ?? c['message']) as string | undefined
      if (fault !== undefined || label) return { fault, label }
    }
  } catch {
    // Cuerpo no JSON (p. ej. fault SDMX en texto/XML): se clasifica por texto.
    const tooBig = /EXTRACTION_TOO_BIG/i.test(bodyText)
    const async_ = /ASYNCHRONOUS_RESPONSE/i.test(bodyText)
    if (tooBig) return { fault: 413, label: 'EXTRACTION_TOO_BIG' }
    if (async_) return { fault: 413, label: 'ASYNCHRONOUS_RESPONSE' }
    const m = bodyText.match(/<faultcode>(\d+)<\/faultcode>/i)
    if (m) return { fault: Number(m[1]), label: bodyText.slice(0, 200) }
  }
  return {}
}

/** Clave asíncrona si el cuerpo la trae (patrón async de la guía oficial). */
function extractAsyncKey(bodyText: string): string | undefined {
  const uuid =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(bodyText)
  return uuid?.[0]
}

/**
 * Convierte una respuesta HTTP de error en EurostatApiError tipado.
 * Distinción RF-10: con HTTP 413, «EXTRACTION_TOO_BIG» = demasiado grande;
 * «ASYNCHRONOUS_RESPONSE» (o clave asíncrona) = en preparación, no un fracaso.
 */
export function errorFromResponse(httpStatus: number, bodyText: string): EurostatApiError {
  const { fault, label } = extractFault(bodyText)
  const detail = label ? ` — ${label}` : ''

  if (httpStatus === 413) {
    if (/ASYNCHRONOUS/i.test(label ?? '') || extractAsyncKey(bodyText)) {
      return new EurostatApiError(
        'in_preparation',
        'Eurostat está preparando esta extracción en segundo plano (franja asíncrona).',
        { fault: 413, httpStatus, asyncKey: extractAsyncKey(bodyText) },
      )
    }
    return new EurostatApiError(
      'too_big',
      `Extracción demasiado grande: supera el máximo autorizado de 5.000.000 de filas estimadas${detail}. Acota los filtros.`,
      { fault: 413, httpStatus },
    )
  }

  switch (Number(fault)) {
    case 100:
      return new EurostatApiError('no_results', 'Sin datos para esta selección.', {
        fault: 100,
        httpStatus,
      })
    case 140:
      return new EurostatApiError('syntax', `Consulta inválida (fault 140)${detail}.`, {
        fault: 140,
        httpStatus,
      })
    case 150:
      return new EurostatApiError('semantic', `La consulta viola una regla de Eurostat (fault 150)${detail}.`, {
        fault: 150,
        httpStatus,
      })
  }

  if (httpStatus === 404) {
    return new EurostatApiError('no_results', 'Sin datos para esta selección (404).', {
      httpStatus,
    })
  }
  if (httpStatus >= 500) {
    return new EurostatApiError('server', `Error del servidor de Eurostat (HTTP ${httpStatus})${detail}.`, {
      httpStatus,
    })
  }
  return new EurostatApiError('http', `Respuesta inesperada de Eurostat (HTTP ${httpStatus})${detail}.`, {
    httpStatus,
  })
}

// ---------------------------------------------------------------------------
// fetchDataset serializado por dataset
// ---------------------------------------------------------------------------

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

/** Cola por dataset: dataset → promesa de la última extracción encolada. */
const queues = new Map<string, Promise<unknown>>()

/**
 * Descarga el JSON-stat crudo de una PivotSpec (el parseo es T03).
 * Las extracciones del MISMO dataset se ejecutan de una en una (C6);
 * las de datasets distintos pueden solaparse. Un fallo no rompe la cola.
 */
export function fetchDataset(
  spec: PivotSpec,
  opts: { fetchImpl?: FetchImpl; signal?: AbortSignal } = {},
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchImpl)
  const key = spec.dataset.trim().toLowerCase()
  const url = buildQuery(spec) // lanza 'invalid_spec' en síncrono si la spec es mala

  const previous = queues.get(key) ?? Promise.resolve()
  const run = previous.then(
    () => doFetch(url, fetchImpl, opts.signal),
    () => doFetch(url, fetchImpl, opts.signal),
  )
  queues.set(key, run)
  // Limpieza: si esta sigue siendo la última de la cola, se borra al asentarse.
  const cleanup = () => {
    if (queues.get(key) === run) queues.delete(key)
  }
  run.then(cleanup, cleanup)
  return run
}

async function doFetch(
  url: string,
  fetchImpl: FetchImpl,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new EurostatApiError(
      'network',
      `No se pudo contactar con Eurostat: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }

  const text = await response.text()

  // La Statistics API puede avisar de tratamiento asíncrono con un cuerpo
  // {warning:{status:413,...}} incluso sin un 413 «limpio»: se clasifica igual.
  if (!response.ok || /ASYNCHRONOUS_RESPONSE/i.test(text)) {
    throw errorFromResponse(response.ok ? 413 : response.status, text)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new EurostatApiError('http', 'Eurostat devolvió una respuesta que no es JSON válido.', {
      httpStatus: response.status,
    })
  }
}

/** Solo para tests: vacía las colas de serialización. */
export function _resetQueuesForTests(): void {
  queues.clear()
}
