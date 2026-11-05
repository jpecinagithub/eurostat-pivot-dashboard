/**
 * Smoke en vivo a nivel API (T15): ejecuta contra Eurostat REAL la
 * consulta exacta del enlace M1 y verifica la respuesta (updated,
 * países y el valor de España en el último periodo). Complementa a
 * e2e-live.mjs (navegador): en esta VM el Chromium no puede salir a
 * ec.europa.eu (el proxy de egress rechaza su CONNECT, verificado
 * 2026-11-05: curl con el mismo proxy → 200; Chromium directo y con
 * proxy → ERR_TUNNEL_CONNECTION_FAILED), así que la pata de red se
 * verifica aquí y la de render en scripts/e2e.mjs con fixtures.
 *
 * Uso: node scripts/smoke-live-api.mjs
 */
const url =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_pc' +
  '?format=JSON&lang=EN&unit=CP_PPS_EU27_2020_HAB&na_item=B1GQ' +
  '&geo=ES&geo=FR&geo=DE&geo=EU27_2020&lastTimePeriod=10'

const res = await fetch(url)
console.log(`HTTP ${res.status}`)
if (!res.ok) {
  console.log('SMOKE API: FAIL (HTTP no OK)')
  process.exit(1)
}
const data = await res.json()
const geos = Object.keys(data.dimension.geo.category.index)
const times = Object.keys(data.dimension.time.category.index).sort()
const last = times[times.length - 1]
const geoPos = data.dimension.geo.category.index
const timePos = data.dimension.time.category.index
const nTimes = data.size[data.id.indexOf('time')]
const esIndex = geoPos.ES * nTimes + timePos[last]
const esValue = data.value[String(esIndex)]
console.log(`updated: ${data.updated}`)
console.log(`geos: ${geos.join(', ')}`)
console.log(`periodos: ${times[0]}…${last} (${times.length})`)
console.log(`España ${last}: ${esValue}`)
const ok =
  Boolean(data.updated) &&
  ['ES', 'FR', 'DE', 'EU27_2020'].every((g) => geos.includes(g)) &&
  times.length === 10 &&
  typeof esValue === 'number'
console.log(ok ? 'SMOKE API: PASS' : 'SMOKE API: FAIL')
process.exit(ok ? 0 : 1)
