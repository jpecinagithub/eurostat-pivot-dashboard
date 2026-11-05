import { SDMX_21_BASE } from './eurostat'

/**
 * EUROPIVOT — Codelist Service (etiquetas descriptivas).
 *
 * El content constraint da los CÓDIGOS disponibles; los NOMBRES
 * oficiales viven en las codelists SDMX 2.1 (`codelist/ESTAT/{ID}`),
 * con Name en EN/FR/DE por código. Este servicio las descarga una
 * sola vez por sesión y codelist (UNIT se reutiliza en casi todos
 * los datasets) y devuelve code → nombre EN.
 *
 * Sin traducción inventada: el nombre es el oficial de Eurostat.
 * El español llega por el diccionario propio donde existe (geo, T14)
 * y, para el resto, la UI muestra el nombre oficial EN — descriptivo
 * aunque no sea ES — antes que un código críptico.
 */

export class CodelistServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CodelistServiceError'
  }
}

type FetchImpl = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

function elementsByLocalName(root: ParentNode, local: string): Element[] {
  const all = root.querySelectorAll('*')
  const out: Element[] = []
  for (const el of all) if (el.localName === local) out.push(el)
  return out
}

/** code → nombre oficial EN desde el XML de una codelist SDMX 2.1. */
export function parseCodelist(xml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) {
    throw new CodelistServiceError('Eurostat devolvió una codelist XML inválida.')
  }
  const names = new Map<string, string>()
  for (const code of elementsByLocalName(doc, 'Code')) {
    const id = code.getAttribute('id')
    if (!id) continue
    for (const child of code.children) {
      if (child.localName === 'Name' && child.getAttribute('xml:lang') === 'en') {
        const text = child.textContent?.trim()
        if (text) names.set(id, text)
        break
      }
    }
  }
  return names
}

const cache = new Map<string, Promise<Map<string, string>>>()

export function fetchCodelist(
  codelistId: string,
  fetchImpl: FetchImpl = globalThis.fetch as FetchImpl,
): Promise<Map<string, string>> {
  const key = codelistId.toUpperCase()
  const hit = cache.get(key)
  if (hit) return hit
  const promise = (async () => {
    const res = await fetchImpl(`${SDMX_21_BASE}/codelist/ESTAT/${key}/latest`)
    if (!res.ok) {
      throw new CodelistServiceError(`codelist ${key}: HTTP ${res.status}`)
    }
    return parseCodelist(await res.text())
  })()
  cache.set(key, promise)
  // Un fallo no envenena la caché: el siguiente intento puede reintentar.
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key)
  })
  return promise
}

export function _resetCodelistCacheForTests(): void {
  cache.clear()
}
