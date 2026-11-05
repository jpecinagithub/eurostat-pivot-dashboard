#!/usr/bin/env node
/**
 * EUROPIVOT — Generador del índice estático del catálogo (T04).
 *
 * Por qué existe: la Catalogue API de Eurostat NO envía cabeceras CORS
 * (demostrado en la puerta T00, docs/T00-resultados.md), así que el
 * navegador no puede leer el TOC en vivo. El índice se genera en tiempo
 * de compilación desde el TOC oficial y se sirve con la app.
 *
 * Uso:
 *   node scripts/build-catalogue-index.mjs           → regenera el índice
 *   node scripts/build-catalogue-index.mjs --soft    → si la descarga
 *     falla y ya existe un índice, avisa y sale con 0 (modo prebuild)
 *
 * Salida: src/config/catalogue-index.json (versionado, con generatedAt:
 * la frescura del índice se declara, nunca se disimula).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOC_URL = 'https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=EN'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'config', 'catalogue-index.json')
const soft = process.argv.includes('--soft')

/** Divide una línea TSV del TOC respetando los campos entrecomillados. */
function splitTsv(line) {
  const fields = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else quoted = false
      } else current += ch
    } else if (ch === '"') quoted = true
    else if (ch === '\t') {
      fields.push(current)
      current = ''
    } else current += ch
  }
  fields.push(current)
  return fields
}

/** «28.10.2026» → «2026-10-28»; cualquier otra cosa → undefined. */
function toIsoDate(ddmmyyyy) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((ddmmyyyy ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
}

/**
 * TOC TXT → entradas con datos. La jerarquía va codificada en la
 * indentación del título (4 espacios por nivel); la ruta de carpetas
 * (sin la raíz de nivel 0) queda como `theme` de cada dataset/tabla.
 */
export function parseToc(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const entries = []
  const stack = [] // stack[depth] = título de carpeta vigente a esa profundidad
  for (const line of lines.slice(1)) {
    // La cabecera es la primera línea; el resto son datos.
    const fields = splitTsv(line)
    if (fields.length < 3) continue
    const [rawTitle, code, type, lastUpdate, , dataStart, dataEnd, values] = fields
    const indent = rawTitle.length - rawTitle.trimStart().length
    const depth = Math.round(indent / 4)
    const title = rawTitle.trim()
    if (type === 'folder') {
      stack[depth] = title
      stack.length = depth + 1
      continue
    }
    if (type !== 'dataset' && type !== 'table') continue
    const entry = {
      code: code.trim(),
      title,
      type,
      theme: stack.slice(1, depth).filter(Boolean),
    }
    const iso = toIsoDate(lastUpdate)
    if (iso) entry.lastUpdate = iso
    if (dataStart?.trim()) entry.dataStart = dataStart.trim()
    if (dataEnd?.trim()) entry.dataEnd = dataEnd.trim()
    const n = Number(values)
    if (Number.isFinite(n) && values?.trim()) entry.values = n
    entries.push(entry)
  }
  return entries
}

async function main() {
  const res = await fetch(TOC_URL)
  if (!res.ok) throw new Error(`TOC respondió HTTP ${res.status}`)
  const text = await res.text()
  const parsed = parseToc(text)
  if (parsed.length < 1000) {
    throw new Error(`Índice sospechosamente pequeño: ${parsed.length} entradas (¿cambió el TOC?)`)
  }
  // Las rutas de temas se repiten miles de veces: se internan en una tabla
  // y cada entrada guarda solo el índice (el servicio las resuelve al cargar).
  const themeTable = []
  const themeIds = new Map()
  const entries = parsed.map(({ theme, ...rest }) => {
    const key = theme.join('\u0000')
    if (!themeIds.has(key)) {
      themeIds.set(key, themeTable.length)
      themeTable.push(theme)
    }
    return { ...rest, theme: themeIds.get(key) }
  })
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: TOC_URL,
    themes: themeTable,
    entries,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(index))
  const datasets = entries.filter((e) => e.type === 'dataset').length
  console.log(
    `Índice del catálogo generado: ${entries.length} entradas (${datasets} datasets, ${entries.length - datasets} tablas, ${themeTable.length} rutas de tema) → ${OUT}`,
  )
}

main().catch((err) => {
  if (soft && existsSync(OUT)) {
    console.warn(`Aviso: no se pudo regenerar el índice del catálogo (${err.message}). Se conserva el existente.`)
    process.exit(0)
  }
  console.error(`Error generando el índice del catálogo: ${err.message}`)
  process.exit(1)
})
