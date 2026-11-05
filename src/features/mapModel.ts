import type { PivotTable } from '../engine/pivotEngine'
import type { GeoJsonCollection } from '../services/geoService'

/**
 * EUROPIVOT — Modelo del mapa coroplético (T10, RF-16). Puro.
 *
 * Reglas que implementa:
 * - El join dato↔geometría es por código `geo` LITERAL contra NUTS_ID
 *   (C9: nunca se normaliza un código a otro; verificado con
 *   nama_10r_2gdp: 293/309 códigos NUTS 2 unen tal cual; los 16 que no
 *   unen son pseudorregiones «sin especificar» tipo ESZZ).
 * - Lo que no tiene geometría en el nivel elegido (agregados UE/EA,
 *   pseudorregiones ZZ, códigos de otro nivel) NO se inventa: sale del
 *   mapa a una lista aparte con su valor (RF-16).
 * - La proyección es Mercator sobre la extensión europea habitual de
 *   Eurostat (lon −32…45, lat 27…71,5): Canarias, Azores, Islandia y
 *   Chipre dentro; Svalbard y los territorios de ultramar franceses
 *   quedan fuera del encuadre y el SVG los recorta.
 * - La escala de color son 5 clases de intervalo igual sobre el rango
 *   real de los datos del periodo, con la leyenda en números (la misma
 *   honestidad que los ejes del gráfico: nada de colores sin escala).
 */

export type NutsLevel = 0 | 1 | 2 | 3

/** Nivel NUTS dominante de una lista de códigos geo, por longitud:
 *  2→país(0), 3→NUTS 1, 4→NUTS 2, 5→NUTS 3. Los agregados (EU27_2020…)
 *  y códigos con separadores quedan fuera del conteo — ojo: EA21
 *  (zona euro) tiene 4 caracteres como un NUTS 2 y hay que excluirlo
 *  por familia, no por longitud. */
const AGGREGATE_FAMILY = /^(EU|EA\d|EFTA|EEA)/
export function nutsLevelForCodes(codes: string[]): NutsLevel | null {
  const counts = new Map<number, number>()
  for (const c of codes) {
    if (!/^[A-Z0-9]+$/.test(c)) continue
    if (AGGREGATE_FAMILY.test(c)) continue
    if (c.length < 2 || c.length > 5) continue
    counts.set(c.length, (counts.get(c.length) ?? 0) + 1)
  }
  let best: number | null = null
  let bestN = 0
  for (const [len, n] of counts) {
    if (n > bestN) {
      best = len
      bestN = n
    }
  }
  return best === null ? null : ((best - 2) as NutsLevel)
}

const LON_MIN = -32
const LON_MAX = 45
const LAT_MIN = 27
const LAT_MAX = 71.5

function mercY(latDeg: number): number {
  const lat = Math.max(LAT_MIN, Math.min(LAT_MAX, latDeg))
  const rad = (lat * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

export interface Projector {
  project: (lon: number, lat: number) => [number, number]
  width: number
  height: number
}

export function europeProjector(width = 640, height = 560): Projector {
  const x0 = ((LON_MIN + 180) * Math.PI) / 180
  const x1 = ((LON_MAX + 180) * Math.PI) / 180
  const y0 = mercY(LAT_MAX)
  const y1 = mercY(LAT_MIN)
  const scale = Math.min(width / (x1 - x0), height / (y0 - y1))
  const ox = (width - (x1 - x0) * scale) / 2
  const oy = (height - (y0 - y1) * scale) / 2
  return {
    width,
    height,
    project: (lon, lat) => {
      const x = ((lon + 180) * Math.PI) / 180
      return [ox + (x - x0) * scale, oy + (y0 - mercY(lat)) * scale]
    },
  }
}

export interface RegionShape {
  id: string
  name: string
  path: string
}

/** Convierte el GeoJSON de un nivel en paths SVG listos para pintar. */
export function geoJsonToShapes(fc: GeoJsonCollection, proj: Projector): Map<string, RegionShape> {
  const out = new Map<string, RegionShape>()
  for (const f of fc.features) {
    const id = f.properties?.NUTS_ID
    if (!id) continue
    const polys: number[][][][] =
      f.geometry.type === 'Polygon'
        ? [(f.geometry as { coordinates: number[][][] }).coordinates]
        : f.geometry.type === 'MultiPolygon'
          ? (f.geometry as { coordinates: number[][][][] }).coordinates
          : []
    let d = ''
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach(([lon, lat], i) => {
          const [x, y] = proj.project(lon, lat)
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        d += 'Z'
      }
    }
    if (d) out.set(id, { id, name: f.properties?.NAME_LATN ?? id, path: d })
  }
  return out
}

/** Paleta secuencial naranja (familia del acento Atlas): de oscuro
 *  (valor bajo) a ámbar brillante (valor alto). Sin dato = panel. */
export const CLASS_COLORS = ['#5b2403', '#8f3d07', '#c05f10', '#ec8318', '#fbbf24']
export const NO_DATA_COLOR = '#1b2138'

export interface ColorClass {
  from: number
  to: number
  color: string
}

export function choroplethClasses(values: number[], k = 5): ColorClass[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return [{ from: min, to: max, color: CLASS_COLORS[CLASS_COLORS.length - 1] }]
  const step = (max - min) / k
  return Array.from({ length: k }, (_, i) => ({
    from: min + i * step,
    to: i === k - 1 ? max : min + (i + 1) * step,
    color: CLASS_COLORS[Math.min(i, CLASS_COLORS.length - 1)],
  }))
}

export function classIndexFor(value: number, classes: ColorClass[]): number {
  for (let i = 0; i < classes.length; i++) {
    if (value <= classes[i].to || i === classes.length - 1) return i
  }
  return classes.length - 1
}

export interface ChoroplethData {
  /** Valor y clase por código geo que SÍ tiene geometría. */
  fills: Map<string, { value: number; classIndex: number }>
  /** Filas con valor pero sin geometría en este nivel (RF-16: aparte). */
  aside: { code: string; value: number }[]
  classes: ColorClass[]
  /** Geometrías sin dato en el periodo (se pintan «sin datos»). */
  noData: number
}

/**
 * Cruza la tabla pivot (geografía SOLA en filas, tiempo en columnas)
 * con las geometrías para un periodo. Sin red y sin tocar los datos:
 * sale de la misma tabla que ve el usuario (C4).
 */
export function buildChoropleth(
  table: PivotTable,
  shapes: Map<string, RegionShape>,
  period: string,
): ChoroplethData | null {
  if (table.rowDims.length !== 1 || table.rowDims[0] !== 'geo') return null
  const tIdx = table.colDims.indexOf('time')
  if (tIdx === -1) return null
  const col = table.colKeys.findIndex((ck) => ck[tIdx] === period)
  if (col === -1) return null

  const fills = new Map<string, { value: number; classIndex: number }>()
  const aside: { code: string; value: number }[] = []
  const values: number[] = []
  table.rowKeys.forEach((rk, i) => {
    const code = rk[0]
    const v = table.cells[i][col]?.value
    if (v === null || v === undefined) return
    if (shapes.has(code)) {
      fills.set(code, { value: v, classIndex: 0 })
      values.push(v)
    } else {
      aside.push({ code, value: v })
    }
  })
  const classes = choroplethClasses(values)
  for (const f of fills.values()) f.classIndex = classIndexFor(f.value, classes)
  const noData = [...shapes.keys()].filter((id) => !fills.has(id)).length
  return { fills, aside, classes, noData }
}
