import type { PivotSpec, TimeSelection, VizType } from '../core/types'

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

// QA 2026-11-05: el enlace debe conservar TAMBIÉN el título, la
// visualización y el ancho de cada panel (antes el receptor veía
// título por defecto, gráfico y ancho normal). Cada panel viaja
// ahora como { s: WireV1, t?, v?, w? }. COMPATIBILIDAD: los enlaces
// antiguos llevan el WireV1 pelado por panel — el decodificador
// acepta ambas formas (los enlaces viejos siguen abriendo, con los
// valores por defecto de entonces).

interface WirePanelV1 {
  s: WireV1
  t?: string
  v?: string
  w?: 1 | 2
}

interface WireDashboardV1 {
  v: 1
  name?: string
  panels: (WireV1 | WirePanelV1)[]
}

export interface SharedPanel {
  spec: PivotSpec
  title?: string
  viz?: VizType
  wide?: boolean
}

export interface DecodedDashboard {
  name?: string
  panels: SharedPanel[]
  /** Atajo de compatibilidad: solo las specs, en orden. */
  specs: PivotSpec[]
}

const WIRE_VIZ: VizType[] = ['table', 'line', 'bar', 'map', 'ranking', 'kpi']

function panelToWire(panel: SharedPanel): WirePanelV1 {
  const wire: WirePanelV1 = { s: specToWire(panel.spec) }
  if (panel.title) wire.t = panel.title
  if (panel.viz) wire.v = panel.viz
  if (panel.wide) wire.w = 2
  return wire
}

function wireToPanel(entry: WireV1 | WirePanelV1): SharedPanel | null {
  if (typeof entry !== 'object' || entry === null) return null
  if ('s' in entry) {
    const w = entry as WirePanelV1
    const spec = wireToSpec(w.s as Partial<WireV1>)
    if (!spec) return null
    return {
      spec,
      title: typeof w.t === 'string' && w.t.length > 0 ? w.t : undefined,
      viz: WIRE_VIZ.includes(w.v as VizType) ? (w.v as VizType) : undefined,
      wide: w.w === 2 ? true : undefined,
    }
  }
  // Forma antigua: el panel ES el WireV1 de la spec.
  const spec = wireToSpec(entry as Partial<WireV1>)
  return spec ? { spec } : null
}

export function encodeDashboardParam(
  name: string | undefined,
  panels: (PivotSpec | SharedPanel)[],
): string {
  const wire: WireDashboardV1 = {
    v: 1,
    panels: panels.map((p) =>
      panelToWire('spec' in p ? p : { spec: p }),
    ),
  }
  if (name) wire.name = name
  return PREFIX + toBase64Url(JSON.stringify(wire))
}

export function buildDashboardUrl(
  baseUrl: string,
  name: string | undefined,
  panels: (PivotSpec | SharedPanel)[],
): string {
  const url = new URL(baseUrl)
  url.searchParams.delete('p')
  url.searchParams.set('d', encodeDashboardParam(name, panels))
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
    const panels: SharedPanel[] = []
    for (const p of wire.panels) {
      const panel = wireToPanel(p)
      if (!panel) return null // un panel corrupto invalida el enlace entero
      panels.push(panel)
    }
    return {
      name: typeof wire.name === 'string' ? wire.name : undefined,
      panels,
      specs: panels.map((p) => p.spec),
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
