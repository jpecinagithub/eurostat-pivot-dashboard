/**
 * EUROPIVOT — Cáscara i18n (RNF-01, decisión §3.12: TODO ES por defecto).
 * Esto es solo la cáscara de la app. Las etiquetas de datos (dimensiones y
 * categorías Eurostat) las traduce el ES Dictionary Service en T14 (§2.1):
 * la API no ofrece español (solo EN/FR/DE).
 */
export const es = {
  'app.tagline': 'Compara países, entiende la diferencia, comparte el resultado.',
  'app.dataSource': 'Datos: Eurostat',
  'app.scaffoldNote':
    'Proyecto en construcción (T01: andamiaje). La portada por temas llega en T07 y el constructor pivot en T08.',
  'app.author': 'Un proyecto de Jon Peciña',
  'home.title': 'Datos de Europa, en tablas dinámicas',
  'home.searchPlaceholder': 'Busca un dataset por código o título…',
  'nav.themes': 'Temas',
  'nav.dashboard': 'Mi dashboard',
} as const

export type I18nKey = keyof typeof es

export const en: Record<I18nKey, string> = {
  'app.tagline': 'Compare countries, understand the difference, share the result.',
  'app.dataSource': 'Data: Eurostat',
  'app.scaffoldNote':
    'Work in progress (T01: scaffolding). The themes home page arrives in T07 and the pivot builder in T08.',
  'app.author': 'A project by Jon Peciña',
  'home.title': "Europe's data, in pivot tables",
  'home.searchPlaceholder': 'Search a dataset by code or title…',
  'nav.themes': 'Themes',
  'nav.dashboard': 'My dashboard',
}

export type UiLang = 'es' | 'en'

/** Idioma por defecto de la cáscara: español (decisión expresa de Jon, §3.12). */
export const DEFAULT_UI_LANG: UiLang = 'es'

const dictionaries: Record<UiLang, Record<I18nKey, string>> = { es, en }

export function t(lang: UiLang, key: I18nKey): string {
  return dictionaries[lang][key] ?? es[key] ?? key
}
