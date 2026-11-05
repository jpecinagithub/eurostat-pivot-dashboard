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
    'Busca entre los más de 10.000 datasets de Eurostat o empieza por el pack verificado. Eurostat actualiza sus datos dos veces al día; cada tarjeta muestra la fecha oficial de actualización.',
  'app.author': 'Un proyecto de Jon Peciña',
  'home.title': 'Datos de Europa, en tablas dinámicas',
  'home.searchPlaceholder': 'Busca un dataset por código o título…',
  'home.searchLabel': 'Buscar datasets en el catálogo de Eurostat',
  'home.packTitle': 'Para empezar: el pack EUROPIVOT',
  'home.packNote':
    'Datasets verificados uno a uno (ficha, unidades y reglas de cálculo). Pulsa uno para abrirlo en el constructor.',
  'home.results': 'Resultados',
  'home.noResults': 'Sin resultados para esa búsqueda. Prueba con el código (p. ej. nama_10_gdp) o con menos palabras.',
  'home.loading': 'Cargando el catálogo…',
  'home.updated': 'Actualizado',
  'home.dataUntil': 'Datos hasta',
  'home.inPack': 'En el pack',
  'home.values': 'valores',
  'home.openBuilder': 'Abrir en el constructor',
  'home.builderSoon': 'El constructor pivot llega en la siguiente tarea (T08); tu selección queda guardada.',
  'home.selected': 'Seleccionado',
  'home.themeAll': 'Todos los temas',
  'nav.themes': 'Temas',
  'nav.dashboard': 'Mi dashboard',
} as const

export type I18nKey = keyof typeof es

export const en: Record<I18nKey, string> = {
  'app.tagline': 'Compare countries, understand the difference, share the result.',
  'app.dataSource': 'Data: Eurostat',
  'app.scaffoldNote':
    'Search 10,000+ Eurostat datasets or start from the verified pack. Eurostat refreshes data twice a day; every card shows the official update date.',
  'app.author': 'A project by Jon Peciña',
  'home.title': "Europe's data, in pivot tables",
  'home.searchPlaceholder': 'Search a dataset by code or title…',
  'home.searchLabel': 'Search datasets in the Eurostat catalogue',
  'home.packTitle': 'Start here: the EUROPIVOT pack',
  'home.packNote':
    'Datasets verified one by one (card, units and calculation rules). Pick one to open it in the builder.',
  'home.results': 'Results',
  'home.noResults': 'No results for that search. Try the code (e.g. nama_10_gdp) or fewer words.',
  'home.loading': 'Loading the catalogue…',
  'home.updated': 'Updated',
  'home.dataUntil': 'Data up to',
  'home.inPack': 'In the pack',
  'home.values': 'values',
  'home.openBuilder': 'Open in the builder',
  'home.builderSoon': 'The pivot builder arrives in the next task (T08); your selection is kept.',
  'home.selected': 'Selected',
  'home.themeAll': 'All themes',
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
