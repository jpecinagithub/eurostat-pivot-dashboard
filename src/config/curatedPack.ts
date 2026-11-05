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
  // ------------------------------------- Ampliación Top 100 (2026-11-05)
  // Datasets fuente de los artículos más visitados de Statistics Explained
  // que pidió Jon, mapeados desde la sección de fuentes de cada artículo y
  // verificados en vivo con el mismo protocolo C14 (constraint + ejemplo).
  // Trampa verificada en `sts_inppd_m`: el último periodo del constraint
  // (2026-10) aún no tiene datos en ninguna geografía — el dato real llega
  // hasta 2026-09; por eso su ejemplo usa lastTimePeriod=3.
  {
    code: 'isoc_eb_ai',
    titleEs: 'Uso de inteligencia artificial en las empresas',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_ENT',
    defaultIndicator: 'E_AI_TANY',
    defaults: { size_emp: 'GE10' },
    dims: [
      { id: 'freq' },
      { id: 'size_emp' },
      { id: 'nace_r2' },
      { id: 'indic_is', role: 'metric' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC_ENT: percentOps() },
    aggregateNature:
      'El agregado UE es el porcentaje oficial sobre el conjunto de empresas de la UE calculado por Eurostat, no la media de los porcentajes nacionales.',
    exampleQuery: `${API}/isoc_eb_ai?format=JSON&lang=EN&unit=PC_ENT&indic_is=E_AI_TANY&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'isoc_ai_iaiu',
    titleEs: 'Uso de inteligencia artificial por las personas (IA generativa)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_IND',
    defaultIndicator: 'I_IUAI',
    dims: [
      { id: 'freq' },
      { id: 'ind_type' },
      { id: 'indic_is', role: 'metric' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC_IND: percentOps() },
    aggregateNature:
      'El agregado UE es el porcentaje oficial sobre el conjunto de personas de la UE calculado por Eurostat, no la media de los porcentajes nacionales.',
    exampleQuery: `${API}/isoc_ai_iaiu?format=JSON&lang=EN&unit=PC_IND&indic_is=I_IUAI&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'gov_10a_main',
    titleEs: 'Administraciones públicas: ingresos, gasto y agregados principales',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_GDP',
    defaultIndicator: 'TE',
    defaults: { sector: 'S13' },
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'sector' },
      { id: 'na_item', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC_GDP: percentOps(), MIO_EUR: levelOps(), MIO_NAC: levelOps() },
    aggregateNature:
      'En % del PIB, el agregado UE es el cociente oficial que Eurostat calcula sobre los agregados del conjunto de la UE, no la media de los porcentajes nacionales.',
    exampleQuery: `${API}/gov_10a_main?format=JSON&lang=EN&unit=PC_GDP&sector=S13&na_item=TE&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'sts_inppd_m',
    titleEs: 'Precios de producción industrial, mercado interior (mensual)',
    status: 'activo',
    lastPeriod: '2026-09',
    freq: 'M',
    defaultUnit: 'I21',
    defaultIndicator: 'B-E36',
    dims: [
      { id: 'freq' },
      { id: 'indic_bt', role: 'metric' },
      { id: 'nace_r2', role: 'metric' },
      { id: 's_adj' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      I21: indexOps(),
      I15: indexOps(),
      I10: indexOps(),
      PCH_PRE: percentOps(),
      PCH_SM: percentOps(),
    },
    aggregateNature:
      'El agregado UE es el índice oficial ponderado que calcula Eurostat, no la media de los índices nacionales.',
    exampleQuery: `${API}/sts_inppd_m?format=JSON&lang=EN&unit=I21&indic_bt=PRC_PRR_DOM&nace_r2=B-E36&geo=EU27_2020&lastTimePeriod=3`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'nrg_ind_ren',
    titleEs: 'Cuota de energía renovable',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC',
    defaultIndicator: 'REN',
    dims: [
      { id: 'freq' },
      { id: 'nrg_bal', role: 'metric' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC: percentOps() },
    aggregateNature:
      'La cuota UE es el cociente oficial de Eurostat (energía renovable sobre el consumo final bruto del conjunto de la UE), no la media de las cuotas nacionales.',
    exampleQuery: `${API}/nrg_ind_ren?format=JSON&lang=EN&nrg_bal=REN&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'demo_find',
    titleEs: 'Indicadores de fecundidad',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultIndicator: 'TOTFERRT',
    dims: [
      { id: 'freq' },
      { id: 'indic_de', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      TOTFERRT: perCapitaOps(),
      AGEMOTH: perCapitaOps(),
      MEDAGEMOTH: perCapitaOps(),
    },
    aggregateNature:
      'Los indicadores de la UE son los valores oficiales calculados por Eurostat para el conjunto de la Unión.',
    exampleQuery: `${API}/demo_find?format=JSON&lang=EN&indic_de=TOTFERRT&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'demo_mlexpec',
    titleEs: 'Esperanza de vida por edad y sexo',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'YR',
    defaultIndicator: 'Y_LT1',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'age', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { YR: perCapitaOps() },
    aggregateNature:
      'La esperanza de vida de la UE es la estimación oficial de Eurostat a partir de las tablas de mortalidad del conjunto.',
    exampleQuery: `${API}/demo_mlexpec?format=JSON&lang=EN&unit=YR&age=Y_LT1&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'sdg_05_20',
    titleEs: 'Brecha salarial de género (sin ajustar)',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'PC',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'nace_r2' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC: percentOps() },
    aggregateNature:
      'El valor UE es la brecha oficial que Eurostat calcula para el conjunto a partir de la encuesta de estructura salarial.',
    exampleQuery: `${API}/sdg_05_20?format=JSON&lang=EN&unit=PC&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'lfsi_emp_a',
    titleEs: 'Empleo y población activa por sexo y edad (anual)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'PC_POP',
    defaultIndicator: 'EMP_LFS',
    defaults: { age: 'Y20-64' },
    dims: [
      { id: 'freq' },
      { id: 'indic_em', role: 'metric' },
      { id: 'sex' },
      { id: 'age' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { PC_POP: percentOps(), THS_PER: levelOps() },
    aggregateNature:
      'Los agregados UE son los totales y porcentajes oficiales de la encuesta de población activa (LFS) calculados por Eurostat.',
    exampleQuery: `${API}/lfsi_emp_a?format=JSON&lang=EN&indic_em=EMP_LFS&unit=PC_POP&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'demo_pjangroup',
    titleEs: 'Población a 1 de enero por grupo de edad y sexo',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'NR',
    defaultIndicator: 'TOTAL',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'age', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { NR: levelOps() },
    aggregateNature:
      'El agregado UE es la suma oficial de la población de los Estados miembros a 1 de enero.',
    exampleQuery: `${API}/demo_pjangroup?format=JSON&lang=EN&unit=NR&age=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'lc_lci_lev',
    titleEs: 'Costes laborales por hora (niveles, por actividad)',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'EUR',
    defaultIndicator: 'D1_D4_MD5',
    dims: [
      { id: 'freq' },
      { id: 'unit', role: 'metric' },
      { id: 'lcstruct', role: 'metric' },
      { id: 'nace_r2' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: {
      EUR: perCapitaOps(),
      NAC: perCapitaOps(),
      RT_PRE_EUR: percentOps(),
      RT_PRE_NAC: percentOps(),
    },
    aggregateNature:
      'El coste laboral de la UE es la media oficial ponderada por horas trabajadas que calcula Eurostat, no la media simple de los países.',
    exampleQuery: `${API}/lc_lci_lev?format=JSON&lang=EN&unit=EUR&lcstruct=D1_D4_MD5&nace_r2=B-S_X_O&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'crim_off_cat',
    titleEs: 'Delitos registrados por la policía, por categoría',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'P_HTHAB',
    defaultIndicator: 'ICCS0101',
    dims: [
      { id: 'freq' },
      { id: 'iccs', role: 'metric' },
      { id: 'unit', role: 'metric' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { P_HTHAB: perCapitaOps(), NR: levelOps() },
    aggregateNature:
      'Este dataset no publica agregado de la UE: las comparaciones son entre países, y Eurostat advierte de las diferencias nacionales de registro policial.',
    exampleQuery: `${API}/crim_off_cat?format=JSON&lang=EN&unit=P_HTHAB&iccs=ICCS0101&geo=ES&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'migr_imm1ctz',
    titleEs: 'Inmigración por grupo de edad, sexo y ciudadanía',
    status: 'activo',
    lastPeriod: '2024',
    freq: 'A',
    defaultUnit: 'NR',
    defaultIndicator: 'TOTAL',
    dims: [
      { id: 'freq' },
      { id: 'citizen', role: 'metric' },
      { id: 'agedef' },
      { id: 'age' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { NR: levelOps() },
    aggregateNature:
      'La geografía UE recoge el total oficial de inmigración hacia el conjunto de la Unión publicado por Eurostat.',
    exampleQuery: `${API}/migr_imm1ctz?format=JSON&lang=EN&unit=NR&citizen=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
  {
    code: 'migr_pop3ctb',
    titleEs: 'Población a 1 de enero por grupo de edad, sexo y país de nacimiento',
    status: 'activo',
    lastPeriod: '2025',
    freq: 'A',
    defaultUnit: 'NR',
    defaultIndicator: 'TOTAL',
    dims: [
      { id: 'freq' },
      { id: 'c_birth', role: 'metric' },
      { id: 'age' },
      { id: 'unit', role: 'metric' },
      { id: 'sex' },
      { id: 'geo', role: 'geo' },
      { id: 'time', role: 'time' },
    ],
    validOps: { NR: levelOps() },
    aggregateNature:
      'El agregado UE es la suma oficial de la población de los Estados miembros clasificada por país de nacimiento.',
    exampleQuery: `${API}/migr_pop3ctb?format=JSON&lang=EN&unit=NR&c_birth=TOTAL&geo=EU27_2020&lastTimePeriod=1`,
    verifiedAt: VERIFIED,
  },
]
