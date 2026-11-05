/**
 * EUROPIVOT — Diccionario ES propio (adelanto de T14, §2.1).
 *
 * La API de Eurostat no da español: donde este diccionario tiene la
 * etiqueta, la UI la usa; donde no, cae al nombre oficial EN de la
 * codelist (descriptivo) y solo en último caso al código. Nunca se
 * inventa una traducción sobre la marcha.
 *
 * Cobertura de esta primera entrega: países y agregados geo (la
 * dimensión que todo el mundo lee) y los títulos de las dimensiones
 * habituales. T14 lo ampliará sistemáticamente al pack completo.
 */

export const GEO_LABELS_ES: Record<string, string> = {
  EU27_2020: 'Unión Europea (27 países)',
  EU28: 'Unión Europea (28 países, histórico)',
  EU27: 'Unión Europea (27, composición anterior)',
  EA: 'Zona euro',
  EA21: 'Zona euro (21)',
  EA20: 'Zona euro (20)',
  EA19: 'Zona euro (19)',
  AT: 'Austria',
  BE: 'Bélgica',
  BG: 'Bulgaria',
  HR: 'Croacia',
  CY: 'Chipre',
  CZ: 'Chequia',
  DK: 'Dinamarca',
  EE: 'Estonia',
  FI: 'Finlandia',
  FR: 'Francia',
  DE: 'Alemania',
  EL: 'Grecia',
  HU: 'Hungría',
  IE: 'Irlanda',
  IT: 'Italia',
  LV: 'Letonia',
  LT: 'Lituania',
  LU: 'Luxemburgo',
  MT: 'Malta',
  NL: 'Países Bajos',
  PL: 'Polonia',
  PT: 'Portugal',
  RO: 'Rumanía',
  SK: 'Eslovaquia',
  SI: 'Eslovenia',
  ES: 'España',
  SE: 'Suecia',
  UK: 'Reino Unido',
  GB: 'Reino Unido',
  NO: 'Noruega',
  CH: 'Suiza',
  IS: 'Islandia',
  LI: 'Liechtenstein',
  AD: 'Andorra',
  AL: 'Albania',
  BA: 'Bosnia y Herzegovina',
  ME: 'Montenegro',
  MK: 'Macedonia del Norte',
  RS: 'Serbia',
  TR: 'Turquía',
  UA: 'Ucrania',
  MD: 'Moldavia',
  US: 'Estados Unidos',
  CN: 'China',
  JP: 'Japón',
  TOTAL: 'Total',
}

export const DIM_LABELS_ES: Record<string, string> = {
  freq: 'Frecuencia',
  unit: 'Unidad',
  geo: 'País / territorio',
  time: 'Periodo',
  na_item: 'Componente (cuentas nacionales)',
  indic_de: 'Indicador demográfico',
  indic_ppp: 'Indicador (PPA)',
  ppp_cat18: 'Categoría (PPA)',
  sector: 'Sector',
  s_adj: 'Ajuste estacional y de calendario',
  age: 'Edad',
  sex: 'Sexo',
  coicop18: 'Grupo de consumo (COICOP)',
  statinfo: 'Estadístico',
  rskpovth: 'Umbral de riesgo de pobreza',
  isced11: 'Nivel educativo',
  nrg_bal: 'Balance energético',
  siec: 'Producto energético',
  wat_proc: 'Proceso del agua',
  hhtyp: 'Tipo de hogar',
}

export function geoLabelEs(code: string): string | undefined {
  return GEO_LABELS_ES[code]
}

export function dimLabelEs(dimId: string): string {
  return DIM_LABELS_ES[dimId] ?? dimId
}
