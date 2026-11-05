import type { DatasetCard } from '../core/types'

/**
 * Pack curado de datasets (SDD §2.7). VACÍO a propósito en T01:
 * ningún dataset entra sin su ficha mínima verificada de §3.13,
 * y eso es la tarea T05b (precios primero: familia IPCA ECOICOP v2).
 * Una prueba que solo compruebe «la API devuelve datos» no valida
 * un dataset: los discontinuados siguen respondiendo (C14).
 */
export const CURATED_PACK: DatasetCard[] = []
