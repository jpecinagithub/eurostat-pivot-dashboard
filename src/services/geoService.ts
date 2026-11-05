/**
 * EUROPIVOT — Servicio de geometrías (T10, RF-16).
 *
 * Fuente oficial: GISCO (el servicio geográfico de la Comisión /
 * Eurostat). Ficheros GeoJSON por nivel NUTS, clasificación 2024,
 * escala 20M (la fijada en el SDD §4: nunca 01M por defecto) y CRS
 * 4326 (lon/lat, listo para proyectar en cliente). GISCO responde con
 * CORS `*` (verificado en vivo 2026-11-05), así que el navegador los
 * descarga directos, sin backend. Cada nivel se cachea en memoria por
 * sesión: la geometría es «casi permanente» (tabla de caché del SDD).
 *
 * © EuroGeographics para los límites administrativos (aviso C12 que
 * la UI muestra junto al mapa).
 */

export interface GeoJsonFeature {
  type: 'Feature'
  properties: { NUTS_ID?: string; NAME_LATN?: string; LEVL_CODE?: number }
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: string; coordinates: unknown }
}

export interface GeoJsonCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export const NUTS_YEAR = 2024

export function giscoNutsUrl(level: 0 | 1 | 2 | 3): string {
  return `https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_20M_${NUTS_YEAR}_4326_LEVL_${level}.geojson`
}

const cache = new Map<number, Promise<GeoJsonCollection>>()

export function fetchNutsGeoJson(
  level: 0 | 1 | 2 | 3,
  fetchImpl: typeof fetch = fetch,
): Promise<GeoJsonCollection> {
  const hit = cache.get(level)
  if (hit) return hit
  const p = fetchImpl(giscoNutsUrl(level)).then((r) => {
    if (!r.ok) throw new Error(`GISCO HTTP ${r.status}`)
    return r.json() as Promise<GeoJsonCollection>
  })
  // Un fallo no se cachea: el siguiente intento puede funcionar.
  p.catch(() => cache.delete(level))
  cache.set(level, p)
  return p
}

export function _resetGeoCacheForTests(): void {
  cache.clear()
}
