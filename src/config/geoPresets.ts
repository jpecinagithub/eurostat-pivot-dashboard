/**
 * Presets geográficos de EUROPIVOT (RF-25): comparar países en 1 clic.
 * Son DATOS de configuración (composición política de la UE), no lógica
 * del motor (C2). El constructor los intersecta con las categorías geo
 * que el dataset realmente ofrece según su content constraint (T05):
 * un preset nunca promete un país que el dataset no tiene.
 */

export const EU27_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'EL',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
] as const

/** Zona euro (20 países, con Croacia desde 2023). */
export const EURO_AREA_CODES = [
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'EL', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
] as const

/** España y sus vecinos (Andorra incluida: algunos datasets la traen). */
export const SPAIN_NEIGHBORS_CODES = ['ES', 'FR', 'PT', 'IT', 'AD'] as const

export type GeoPresetId = 'eu27' | 'euro-area' | 'spain-neighbors' | 'all-countries'

export const GEO_PRESETS: { id: GeoPresetId; codes: readonly string[] | 'geoLevel' }[] = [
  { id: 'eu27', codes: EU27_CODES },
  { id: 'euro-area', codes: EURO_AREA_CODES },
  { id: 'spain-neighbors', codes: SPAIN_NEIGHBORS_CODES },
  // «Todos los países» no es una lista: es geoLevel=country (RF-25),
  // que la API resuelve por nosotros y excluye regiones y agregados.
  { id: 'all-countries', codes: 'geoLevel' },
]
