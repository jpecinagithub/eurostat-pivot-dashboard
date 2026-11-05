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
  return PREFIX + toBase64Url(JSON.stringify(specToWire(spec)))
}

function specToWire(spec: PivotSpec): WireV1 {
  const wire: WireV1 = {
    v: 1,
    d: spec.dataset,
    f: spec.filters,
    t: spec.time,
    r: spec.rows,
    c: spec.columns,
  }
  if (spec.geoLevel === 'country') wire.g = 'country'
  return wire
}

function wireToSpec(wire: Partial<WireV1>): PivotSpec | null {
  if (wire.v !== 1) return null
  if (typeof wire.d !== 'string' || wire.d.length === 0) return null
  if (typeof wire.f !== 'object' || wire.f === null) return null
  for (const codes of Object.values(wire.f)) {
    if (!Array.isArray(codes) || !codes.every((c) => typeof c === 'string')) return null
  }
  if (!isTimeSelection(wire.t)) return null
  if (!Array.isArray(wire.r) || !Array.isArray(wire.c)) return null
  if (!wire.r.every((x) => typeof x === 'string') || !wire.c.every((x) => typeof x === 'string'))
    return null
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
}

/** Validador estructural de una PivotSpec ya decodificada (persistencia). */
export function isPivotSpecLike(value: unknown): value is PivotSpec {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<PivotSpec>
  if (typeof s.dataset !== 'string' || s.dataset.length === 0) return false
  if (typeof s.filters !== 'object' || s.filters === null) return false
  for (const codes of Object.values(s.filters)) {
    if (!Array.isArray(codes) || !codes.every((c) => typeof c === 'string')) return false
  }
  if (!isTimeSelection(s.time)) return false
  if (!Array.isArray(s.rows) || !Array.isArray(s.columns)) return false
  return true
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
    return wireToSpec(parsed as Partial<WireV1>)
  } catch {
    return null
  }
}

/** Lee `?p=` de una query string (location.search) y decodifica. */
export function specFromSearch(search: string): PivotSpec | null {
  const params = new URLSearchParams(search)
  return decodePanelParam(params.get('p'))
}

// ---------------------------------------------------------------------
// Codec de DASHBOARD (T11, RF-20): `?d=v1.<base64url>` con la colección
// completa de paneles. Cada panel viaja en el MISMO WireV1 del codec de
// un panel — por eso los enlaces `?p=` de M1 siguen abriendo tal cual
// (compatibilidad verificada por test con el enlace real de M1) y un
// dashboard de un solo panel es trivialmente convertible.

interface WireDashboardV1 {
  v: 1
  name?: string
  panels: WireV1[]
}

export interface DecodedDashboard {
  name?: string
  specs: PivotSpec[]
}

export function encodeDashboardParam(name: string | undefined, specs: PivotSpec[]): string {
  const wire: WireDashboardV1 = { v: 1, panels: specs.map(specToWire) }
  if (name) wire.name = name
  return PREFIX + toBase64Url(JSON.stringify(wire))
}

export function buildDashboardUrl(
  baseUrl: string,
  name: string | undefined,
  specs: PivotSpec[],
): string {
  const url = new URL(baseUrl)
  url.searchParams.delete('p')
  url.searchParams.set('d', encodeDashboardParam(name, specs))
  return url.toString()
}

export function decodeDashboardParam(
  param: string | null | undefined,
): DecodedDashboard | null {
  if (!param || !param.startsWith(PREFIX)) return null
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(param.slice(PREFIX.length)))
    if (typeof parsed !== 'object' || parsed === null) return null
    const wire = parsed as Partial<WireDashboardV1>
    if (wire.v !== 1 || !Array.isArray(wire.panels) || wire.panels.length === 0) return null
    const specs: PivotSpec[] = []
    for (const p of wire.panels) {
      const spec = wireToSpec(p as Partial<WireV1>)
      if (!spec) return null // un panel corrupto invalida el enlace entero
      specs.push(spec)
    }
    return {
      name: typeof wire.name === 'string' ? wire.name : undefined,
      specs,
    }
  } catch {
    return null
  }
}

/** Lee `?d=` de una query string y decodifica el dashboard completo. */
export function dashboardFromSearch(search: string): DecodedDashboard | null {
  const params = new URLSearchParams(search)
  return decodeDashboardParam(params.get('d'))
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
