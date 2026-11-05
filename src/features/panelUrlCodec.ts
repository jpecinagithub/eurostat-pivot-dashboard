import type { PivotSpec, TimeSelection } from '../core/types'

/**
 * EUROPIVOT — Codec de URL de UN panel (T09b/M1; adelantado de T11
 * por el ajuste v2.1). Formato versionado: `?p=v1.<base64url>`.
 *
 * RF-20: el enlace codifica la CONFIGURACIÓN, no los datos — al
 * abrirlo se vuelve a consultar Eurostat y las cifras pueden haber
 * sido revisadas por la fuente. T11 ampliará este mismo formato a
 * dashboards multipanel SIN romper estos enlaces (compatibilidad
 * obligatoria, con test).
 *
 * Decodificar nunca lanza: basura en la URL = null, y la app arranca
 * normal sin panel.
 */

const PREFIX = 'v1.'

interface WireV1 {
  v: 1
  d: string
  f: Record<string, string[]>
  t: TimeSelection
  g?: 'country'
  r: string[]
  c: string[]
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePanelParam(spec: PivotSpec): string {
  const wire: WireV1 = {
    v: 1,
    d: spec.dataset,
    f: spec.filters,
    t: spec.time,
    r: spec.rows,
    c: spec.columns,
  }
  if (spec.geoLevel === 'country') wire.g = 'country'
  return PREFIX + toBase64Url(JSON.stringify(wire))
}

export function buildPanelUrl(baseUrl: string, spec: PivotSpec): string {
  const url = new URL(baseUrl)
  url.searchParams.set('p', encodePanelParam(spec))
  return url.toString()
}

function isTimeSelection(value: unknown): value is TimeSelection {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  if (t.mode === 'last') return typeof t.n === 'number' && t.n >= 1
  if (t.mode === 'range') return typeof t.since === 'string' && typeof t.until === 'string'
  if (t.mode === 'values') {
    return Array.isArray(t.values) && t.values.every((v) => typeof v === 'string')
  }
  return false
}

export function decodePanelParam(param: string | null | undefined): PivotSpec | null {
  if (!param || !param.startsWith(PREFIX)) return null
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(param.slice(PREFIX.length)))
    if (typeof parsed !== 'object' || parsed === null) return null
    const wire = parsed as Partial<WireV1>
    if (wire.v !== 1) return null
    if (typeof wire.d !== 'string' || wire.d.length === 0) return null
    if (typeof wire.f !== 'object' || wire.f === null) return null
    for (const codes of Object.values(wire.f)) {
      if (!Array.isArray(codes) || !codes.every((c) => typeof c === 'string')) return null
    }
    if (!isTimeSelection(wire.t)) return null
    if (!Array.isArray(wire.r) || !Array.isArray(wire.c)) return null
    const spec: PivotSpec = {
      dataset: wire.d,
      lang: 'EN',
      filters: wire.f,
      time: wire.t,
      rows: wire.r,
      columns: wire.c,
    }
    if (wire.g === 'country') spec.geoLevel = 'country'
    return spec
  } catch {
    return null
  }
}

/** Lee `?p=` de una query string (location.search) y decodifica. */
export function specFromSearch(search: string): PivotSpec | null {
  const params = new URLSearchParams(search)
  return decodePanelParam(params.get('p'))
}

/**
 * La comparación del hito M1 (§4.6): PIB per cápita en PPA de
 * España, Francia y Alemania + el agregado oficial UE, últimos
 * 10 años, unidad común de la ficha de nama_10_pc.
 */
export const M1_SPEC: PivotSpec = {
  dataset: 'nama_10_pc',
  lang: 'EN',
  filters: {
    unit: ['CP_PPS_EU27_2020_HAB'],
    na_item: ['B1GQ'],
    geo: ['ES', 'FR', 'DE', 'EU27_2020'],
  },
  time: { mode: 'last', n: 10 },
  rows: ['geo'],
  columns: ['time'],
}
