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
  indic_is: 'Indicador',
  indic_sb: 'Indicador',
  indic_em: 'Indicador de empleo',
  indic_il: 'Indicador',
  indic_d: 'Indicador',
  nace_r2: 'Actividad económica (NACE)',
  lcstruct: 'Componente del coste laboral',
  iccs: 'Delito (clasificación ICCS)',
  citizen: 'Ciudadanía',
  c_birth: 'País de nacimiento',
  size_emp: 'Tamaño de la empresa',
  wstatus: 'Situación laboral',
  ind_type: 'Tipo de indicador',
  indic_bt: 'Indicador',
  agedef: 'Definición de la edad',
}

export function geoLabelEs(code: string): string | undefined {
  return GEO_LABELS_ES[code]
}

export function dimLabelEs(dimId: string): string {
  return DIM_LABELS_ES[dimId] ?? dimId
}

/**
 * Etiquetas ES por dimensión para las categorías que la gente lee
 * (T14): unidades completas del pack, sexo, edad, ajuste, sector,
 * tamaño de empresa, frecuencia. La clave es el id de dimensión,
 * estable entre datasets (la dimensión `unit` se llama `unit` en
 * todo Eurostat).
 */
export const CATEGORY_LABELS_ES: Record<string, Record<string, string>> = {
  unit: {
    CP_MEUR: 'Precios corrientes, millones de euros',
    CLV20_MEUR: 'Volúmenes encadenados (referencia 2020), millones de euros',
    CLV_PCH_PRE_HAB: 'Volúmenes encadenados, variación (%) respecto al periodo anterior, por habitante',
    CP_PPS_EU27_2020_HAB: 'Precios corrientes, estándar de poder adquisitivo (UE27 2020 = 100), por habitante',
    PPS_EU27_2020_HAB: 'Estándar de poder adquisitivo (UE27 2020 = 100), por habitante',
    EUR: 'Euros',
    NAC: 'Moneda nacional',
    MIO_EUR: 'Millones de euros',
    MIO_NAC: 'Millones en moneda nacional',
    NR: 'Número',
    PC: 'Porcentaje',
    PC_GDP: 'Porcentaje del PIB',
    PC_ACT: 'Porcentaje de la población activa',
    PC_POP: 'Porcentaje de la población',
    PC_ENT: 'Porcentaje de empresas',
    PC_IND: 'Porcentaje de personas',
    PC_HH: 'Porcentaje de hogares',
    THS_PER: 'Miles de personas',
    PER_KM2: 'Personas por km²',
    P_HTHAB: 'Por 100.000 habitantes',
    YR: 'Años',
    KTOE: 'Miles de toneladas equivalentes de petróleo',
    MIO_M3: 'Millones de metros cúbicos',
    I21: 'Índice (2021 = 100)',
    I25: 'Índice (2025 = 100)',
    I15: 'Índice (2015 = 100)',
    INX_A_AVG: 'Índice, media anual',
    RCH_A: 'Tasa de variación anual (%)',
    RCH_M: 'Tasa de variación mensual (%)',
    PCH_PRE: 'Variación (%) respecto al periodo anterior',
    PCH_SM: 'Variación (%) respecto al mismo periodo del año anterior',
  },
  sex: {
    M: 'Hombres',
    F: 'Mujeres',
    T: 'Total',
  },
  age: {
    TOTAL: 'Total',
    Y_LT1: 'Menos de 1 año',
    'Y15-24': 'De 15 a 24 años',
    'Y15-64': 'De 15 a 64 años',
    'Y20-64': 'De 20 a 64 años',
    Y_GE65: '65 años o más',
  },
  s_adj: {
    SA: 'Corregido de estacionalidad',
    SCA: 'Corregido de estacionalidad y de calendario',
    NSA: 'Sin corregir',
    TRD: 'Tendencia-ciclo',
  },
  sector: {
    S1: 'Economía total',
    S13: 'Administraciones públicas',
    S1311: 'Administración central',
    S14: 'Hogares',
    S15: 'Instituciones sin fines de lucro',
  },
  size_emp: {
    '0_1': 'De 0 a 1 empleados',
    '0-9': 'De 0 a 9 empleados',
    '2-9': 'De 2 a 9 empleados',
    '10-49': 'De 10 a 49 empleados',
    '10-249': 'De 10 a 249 empleados',
    '50-249': 'De 50 a 249 empleados',
    GE10: '10 o más empleados',
    GE250: '250 o más empleados',
  },
  freq: {
    A: 'Anual',
    Q: 'Trimestral',
    M: 'Mensual',
  },
  citizen: { TOTAL: 'Total' },
  c_birth: { TOTAL: 'Total' },
}

/**
 * Códigos de indicador únicos entre datasets (su significado no
 * depende de la dimensión concreta que los aloja: indic_is,
 * indic_sb, na_item, iccs…). Se resuelven por código cuando la
 * dimensión no tiene diccionario propio.
 */
export const GLOBAL_CODE_LABELS_ES: Record<string, string> = {
  B1GQ: 'Producto interior bruto (PIB)',
  TE: 'Gasto total',
  TR: 'Ingresos totales',
  GD: 'Deuda bruta de las administraciones públicas',
  JAN: 'Población a 1 de enero',
  TOTFERRT: 'Tasa global de fecundidad (hijos por mujer)',
  EMP_LFS: 'Empleo (concepto de la encuesta de población activa)',
  E_AI_TANY: 'Usa al menos una tecnología de inteligencia artificial',
  I_IUAI: 'Ha utilizado herramientas de inteligencia artificial',
  REN: 'Energías renovables',
  GIC: 'Consumo interior bruto de energía',
  RFW_RES: 'Recursos renovables de agua dulce',
  ICCS0101: 'Homicidio intencional',
  B_60: 'Por debajo del 60 % de la renta mediana equivalente',
  D1_D4_MD5: 'Costes laborales totales (remuneración y otros costes, sin subvenciones)',
  'B-E36': 'Industria, energía y suministro de agua (secciones B a E36)',
  VI_PPS_EU27_2020_HAB: 'Índice de volumen del PIB por habitante en estándar de poder adquisitivo (UE27 2020 = 100)',
  TOTAL: 'Total',
}

/** Etiqueta ES de una categoría: diccionario de su dimensión, geo o global. */
export function categoryLabelEs(dim: string, code: string): string | undefined {
  if (dim === 'geo') return GEO_LABELS_ES[code]
  return CATEGORY_LABELS_ES[dim]?.[code] ?? GLOBAL_CODE_LABELS_ES[code]
}
