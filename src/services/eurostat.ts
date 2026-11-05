/**
 * Superficies oficiales de Eurostat (SDD §2.1, verificadas 2026-11-05).
 * Sin autenticación ni API key en ninguna. Esto son solo las constantes:
 * el cliente de datos llega en T02 y el parser JSON-stat en T03.
 */
export const STATISTICS_API_BASE =
  'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'
export const COMEXT_STATISTICS_API_BASE =
  'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data'
export const SDMX_3_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/3.0'
export const SDMX_21_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1'
export const CATALOGUE_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/catalogue'
export const ASYNC_STATUS_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/1.0/async/status'
export const GISCO_DISTRIBUTION_BASE = 'https://gisco-services.ec.europa.eu/distribution/v2'
export const NUTS2JSON_BASE = 'https://raw.githubusercontent.com/eurostat/Nuts2json/master/pub/v2'

/** Límites que gobiernan el diseño (SDD §2.2/§4, C5, RF-10). */
export const LIMITS = {
  /** Límite propio interactivo: por encima, la UI obliga a filtrar más (C5). */
  interactiveCellBudget: 200_000,
  /** Franja asíncrona documentada: entre ~500k y 5M Eurostat prepara en segundo plano. */
  asyncFromCells: 500_000,
  /** Fault 413 EXTRACTION_TOO_BIG por encima de 5M de filas estimadas. */
  extractionTooBigCells: 5_000_000,
} as const
