import type { DatasetCard, ValidOps } from '../core/types'

/**
 * Pack curado EUROPIVOT — fichas verificadas de §3.13 (T05b, 2026-11-05).
 *
 * Cada ficha se verificó EN VIVO contra los artefactos oficiales: content
 * constraint SDMX 2.1 (dimensiones, unidades, último periodo) y una
 * consulta de ejemplo real a la Statistics API que devuelve datos. Una
 * prueba de «devuelve datos» no basta (C14): hay códigos presentes en el
 * constraint que no devuelven nada — p. ej. en `ilc_li02` la serie viva
 * del umbral del 60 % es `B_60`, no `A_60` (verificado: A_60 = 0 valores
 * en ES y en UE, 2021–2025; B_60 = 930).
 *
 * Precios primero (orden §3.13): la familia IPCA v1 (prc_hicp_midx /
 * aind / manr, histórica 1996–2025) queda FUERA; el pack usa ECOICOP v2.
 * Resolución de la sucesora de `prc_hicp_manr` (quedó abierta en v2):
 * NO existe dataset v2 separado para la tasa anual mensual — vive dentro
 * de `prc_hicp_minr` como unidad `RCH_A` (verificado en su constraint:
 * unidades I25, I15, RCH_M, RCH_A, RCH_MV12MAVR). Por eso el pack pasa
 * de 20 a 19 fichas: tres datasets v1 se consolidan en dos v2.
 */

const SIN_SUMA_PCT =
  'Sumar porcentajes o tasas de países no tiene sentido estadístico. Usa la media simple (rotulada como calculada) o el agregado oficial de la UE.'
const SIN_SUMA_INDICE =
  'Sumar índices de países no tiene sentido estadístico. Usa la media simple (rotulada como calculada) o el agregado oficial de la UE.'
const SIN_SUMA_PERCAPITA =
  'Un valor por habitante no se suma entre países: el total no representa a ninguna población.'
const SIN_PP =
  'Los puntos porcentuales solo se aplican a porcentajes y tasas, no a esta unidad.'
const SIN_CAGR_TASA =
  'La tasa de crecimiento anual compuesta no se aplica a tasas: usa la diferencia en puntos porcentuales.'

/** Unidades que son porcentajes o tasas (paro, pobreza, % del PIB, tasas IPCA…). */
const percentOps = (): ValidOps => ({
  sum: false,
  mean: true,
  median: true,
  minMax: true,
  deltaPct: true,
  deltaPp: true,
  cagr: false,
  index100: true,
  ranking: true,
  disabledReason: SIN_SUMA_PCT,
})

/** Unidades índice (base 100 en algún año). */
const indexOps = (): ValidOps => ({
  sum: false,
  mean: true,
  median: true,
  minMax: true,
  deltaPct: true,
  deltaPp: false,
  cagr: true,
  index100: true,
  ranking: true,
  disabledReason: SIN_SUMA_INDICE,
})

/** Niveles absolutos (euros corrientes, personas, ktoe…): la suma sí es un total. */
const levelOps = (): ValidOps => ({
  sum: true,
  mean: true,
  median: true,
  minMax: true,
  deltaPct: true,
  deltaPp: false,
  cagr: true,
  index100: true,
  ranking: true,
  disabledReason: SIN_PP,
})

/** Valores por habitante o por km²: comparables, no sumables. */
const perCapitaOps = (): ValidOps => ({
  sum: false,
  mean: true,
  median: true,
  minMax: true,
  deltaPct: true,
  deltaPp: false,
  cagr: true,
  index100: true,
  ranking: true,
  disabledReason: SIN_SUMA_PERCAPITA,
})

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
const VERIFIED = '2026-11-05'

export const CURATED_PACK: DatasetCard[] = [
  // ------------------------------------------------------------------ Economía
  {
    code: 'nama_10_gdp',
    titleEs: 'PIB y componentes principales (anual)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'CP_MEUR',
    defaultIndicator: 'B1GQ',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      CP_MEUR: levelOps(),
      CLV20_MEUR: levelOps(),
      PC_GDP: percentOps(),
    },
    aggregateNature:
      'Para niveles en euros, el agregado UE es la suma oficial de los Estados miembros calculada por Eurostat.',
    exampleQuery: `${API}/nama_10_gdp?format=JSON&lang=EN&unit=CP_MEUR&na_item=B1GQ&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'namq_10_gdp',
    titleEs: 'PIB y componentes principales (trimestral)',
    status: 'activo',
    lastPeriod: '2026-Q3',
    freq: 'Q',
    defaultUnit: 'CLV20_MEUR',
    defaultIndicator: 'B1GQ',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 's_adj' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      CLV20_MEUR: levelOps(),
      CP_MEUR: levelOps(),
    },
    aggregateNature:
      'Para niveles, el agregado UE es la suma oficial de los Estados miembros calculada por Eurostat. La serie titular trimestral es la ajustada de estacionalidad y calendario (s_adj=SCA) en volúmenes encadenados.',
    exampleQuery: `${API}/namq_10_gdp?format=JSON&lang=EN&unit=CLV20_MEUR&na_item=B1GQ&s_adj=SCA&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'nama_10_pc',
    titleEs: 'PIB per cápita y consumo per cápita',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'CP_PPS_EU27_2020_HAB',
    defaultIndicator: 'B1GQ',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      CP_PPS_EU27_2020_HAB: perCapitaOps(),
      CP_EUR_HAB: perCapitaOps(),
    },
    aggregateNature:
      'Valor per cápita oficial calculado por Eurostat; no es una media de los valores de los países.',
    exampleQuery: `${API}/nama_10_pc?format=JSON&lang=EN&unit=CP_PPS_EU27_2020_HAB&na_item=B1GQ&geo=ES&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'tec00114',
    titleEs: 'PIB per cápita en paridad de poder adquisitivo (PPA)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultIndicator: 'VI_PPS_EU27_2020_HAB',
    dims: [
      { id: 'freq' },
      { id: 'indic_ppp', role: 'metric' },
      { id: 'ppp_cat18' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      VI_PPS_EU27_2020_HAB: indexOps(),
    },
    aggregateNature:
      'Índice de volumen per cápita en PPA calculado por Eurostat, con UE-27 = 100.',
    exampleQuery: `${API}/tec00114?format=JSON&lang=EN&indic_ppp=VI_PPS_EU27_2020_HAB&ppp_cat18=GDP&geo=ES&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'gov_10dd_edpt1',
    titleEs: 'Deuda y déficit de las administraciones públicas',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_GDP',
    defaultIndicator: 'GD',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'sector' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC_GDP: percentOps(),
      MIO_EUR: levelOps(),
    },
    aggregateNature:
      'En % del PIB es el ratio oficial consolidado de Eurostat; en millones es la suma oficial de las administraciones.',
    exampleQuery: `${API}/gov_10dd_edpt1?format=JSON&lang=EN&unit=PC_GDP&sector=S13&na_item=GD&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  // ------------------------------------------------------------------ Precios (ECOICOP v2)
  {
    code: 'prc_hicp_minr',
    titleEs: 'IPCA mensual — índices y tasas (ECOICOP v2)',
    status: 'activo',
    lastPeriod: '2026-10',
    freq: 'M',
    defaultUnit: 'I25',
    defaultIndicator: 'TOTAL',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'coicop18', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      I25: indexOps(),
      RCH_A: percentOps(),
      RCH_M: percentOps(),
    },
    aggregateNature:
      'Índice oficial calculado por Eurostat ponderando países y partidas de consumo; no es una media de los índices nacionales. Sucesor ECOICOP v2 (base 2025=100) de prc_hicp_midx y de prc_hicp_manr: la tasa anual de estos vive aquí como unidad RCH_A.',
    exampleQuery: `${API}/prc_hicp_minr?format=JSON&lang=EN&unit=I25&coicop18=TOTAL&geo=ES&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'prc_hicp_ainr',
    titleEs: 'IPCA anual — índices y tasas (ECOICOP v2)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'INX_A_AVG',
    defaultIndicator: 'TOTAL',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'coicop18', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      INX_A_AVG: indexOps(),
      RCH_A_AVG: percentOps(),
    },
    aggregateNature:
      'Índice anual medio oficial calculado por Eurostat (ECOICOP v2, base 2025=100); no es una media de los índices nacionales. Sucesor de prc_hicp_aind.',
    exampleQuery: `${API}/prc_hicp_ainr?format=JSON&lang=EN&unit=INX_A_AVG&coicop18=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  // ------------------------------------------------------------------ Población
  {
    code: 'demo_pjan',
    titleEs: 'Población a 1 de enero por edad y sexo',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'NR',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'age' },
      { id: 'sex' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      NR: levelOps(),
    },
    aggregateNature:
      'El agregado UE es la suma oficial de las poblaciones nacionales a 1 de enero.',
    exampleQuery: `${API}/demo_pjan?format=JSON&lang=EN&unit=NR&sex=T&age=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'demo_gind',
    titleEs: 'Indicadores demográficos',
    status: 'activo',
    lastPeriod: '2026',
    freq: 'A',
    defaultIndicator: 'JAN',
    dims: [
      { id: 'freq' },
      { id: 'indic_de', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      JAN: levelOps(),
    },
    aggregateNature:
      'Los conteos UE son la suma oficial de países; las tasas e indicadores los calcula Eurostat sobre el total, no son medias de países.',
    exampleQuery: `${API}/demo_gind?format=JSON&lang=EN&indic_de=JAN&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'demo_r_d3dens',
    titleEs: 'Densidad de población por región NUTS 3',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'PER_KM2',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PER_KM2: perCapitaOps(),
    },
    aggregateNature:
      'Densidad oficial (población/superficie); el valor de un agregado es su población entre su superficie, no la media de las densidades regionales.',
    exampleQuery: `${API}/demo_r_d3dens?format=JSON&lang=EN&geoLevel=country&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  // ------------------------------------------------------------------ Empleo y social
  {
    code: 'une_rt_m',
    titleEs: 'Paro por sexo y edad (mensual)',
    status: 'activo',
    lastPeriod: '2026-09',
    freq: 'M',
    defaultUnit: 'PC_ACT',
    dims: [
      { id: 'freq' },
      { id: 's_adj' },
      { id: 'age' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC_ACT: percentOps(),
      THS_PER: levelOps(),
    },
    aggregateNature:
      'La tasa UE la calcula Eurostat sobre el total de la encuesta de población activa (ponderada); no es la media simple de las tasas nacionales.',
    exampleQuery: `${API}/une_rt_m?format=JSON&lang=EN&unit=PC_ACT&s_adj=SA&age=TOTAL&sex=T&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'lfsa_ergaed',
    titleEs: 'Tasa de empleo por nivel educativo',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'age' },
      { id: 'isced11' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC: percentOps(),
    },
    aggregateNature:
      'La tasa UE la calcula Eurostat sobre el total de la encuesta de población activa (ponderada); no es la media simple de las tasas nacionales.',
    exampleQuery: `${API}/lfsa_ergaed?format=JSON&lang=EN&unit=PC&sex=T&age=Y15-64&isced11=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'ilc_li02',
    titleEs: 'Tasa de riesgo de pobreza',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC',
    defaultIndicator: 'B_60',
    dims: [
      { id: 'freq' },
      { id: 'statinfo' },
      { id: 'unit', role: 'metric' },
      { id: 'rskpovth', role: 'metric' },
      { id: 'sex' },
      { id: 'age' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC: percentOps(),
      THS_PER: levelOps(),
    },
    aggregateNature:
      'La tasa UE la calcula Eurostat sobre la población total UE (EU-SILC, ponderada); no es la media simple de las tasas nacionales. Ojo verificado en la ficha: la serie viva del umbral del 60 % es B_60; A_60 consta en el constraint pero no devuelve datos.',
    exampleQuery: `${API}/ilc_li02?format=JSON&lang=EN&unit=PC&statinfo=MED_EI&rskpovth=B_60&sex=T&age=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'ilc_peps01n',
    titleEs: 'Riesgo de pobreza y exclusión social (AROPE)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'age' },
      { id: 'sex' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC: percentOps(),
      THS_PER: levelOps(),
    },
    aggregateNature:
      'La tasa UE la calcula Eurostat sobre la población total UE (EU-SILC, ponderada), definición Europa 2030; no es la media simple de las tasas nacionales.',
    exampleQuery: `${API}/ilc_peps01n?format=JSON&lang=EN&unit=PC&age=TOTAL&sex=T&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  // ------------------------------------------------------------------ Región
  {
    code: 'nama_10r_2gdp',
    titleEs: 'PIB regional por habitante (NUTS 2)',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'PPS_EU27_2020_HAB',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PPS_EU27_2020_HAB: perCapitaOps(),
      MIO_EUR: levelOps(),
    },
    aggregateNature:
      'Valor per cápita regional oficial calculado por Eurostat en PPA; no es una media de regiones.',
    exampleQuery: `${API}/nama_10r_2gdp?format=JSON&lang=EN&unit=PPS_EU27_2020_HAB&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  // ------------------------------------------------------------------ Energía, ambiente, digital, ODS
  {
    code: 'nrg_bal_c',
    titleEs: 'Balances de energía',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'KTOE',
    defaultIndicator: 'GIC',
    dims: [
      { id: 'freq' },
      { id: 'nrg_bal', role: 'metric' },
      { id: 'siec' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      KTOE: levelOps(),
      TJ: levelOps(),
    },
    aggregateNature: 'El agregado UE es la suma oficial de los balances nacionales.',
    exampleQuery: `${API}/nrg_bal_c?format=JSON&lang=EN&nrg_bal=GIC&siec=TOTAL&unit=KTOE&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'env_wat_res',
    titleEs: 'Recursos de agua dulce renovables',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'MIO_M3',
    defaultIndicator: 'RFW_RES',
    dims: [
      { id: 'freq' },
      { id: 'wat_proc', role: 'metric' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      MIO_M3: levelOps(),
      M3_HAB: perCapitaOps(),
    },
    aggregateNature:
      'Para volúmenes, la suma de los países con datos; este dataset no publica agregado UE para el total de recursos (la consulta de ejemplo usa España).',
    exampleQuery: `${API}/env_wat_res?format=JSON&lang=EN&wat_proc=RFW_RES&unit=MIO_M3&geo=ES&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'isoc_ci_in_h',
    titleEs: 'Acceso a internet en los hogares',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_HH',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'hhtyp' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      PC_HH: percentOps(),
    },
    aggregateNature:
      'Porcentaje oficial calculado por Eurostat desde la encuesta TIC (ponderado); no es la media simple de los porcentajes nacionales.',
    exampleQuery: `${API}/isoc_ci_in_h?format=JSON&lang=EN&unit=PC_HH&hhtyp=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'sdg_08_10',
    titleEs: 'ODS 8: crecimiento del PIB real per cápita',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'CLV_PCH_PRE_HAB',
    defaultIndicator: 'B1GQ',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      CLV_PCH_PRE_HAB: {
        ...percentOps(),
        disabledReason: SIN_CAGR_TASA,
      },
      CLV20_EUR_HAB: perCapitaOps(),
    },
    aggregateNature: 'Tasa oficial de crecimiento calculada por Eurostat para el indicador ODS 8.1.1.',
    exampleQuery: `${API}/sdg_08_10?format=JSON&lang=EN&unit=CLV_PCH_PRE_HAB&na_item=B1GQ&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
]
