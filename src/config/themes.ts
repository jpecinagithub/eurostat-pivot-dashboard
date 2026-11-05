/**
 * Los 9 temas estadísticos oficiales de Eurostat (SDD §2.4).
 * Datos de configuración, no lógica (C2). Las tarjetas de la home llegan en T07.
 */
export interface Theme {
  id: string
  es: string
  en: string
}

export const THEMES: Theme[] = [
  { id: 'general-regional', es: 'Estadísticas generales y regionales', en: 'General and regional statistics' },
  { id: 'economy-finance', es: 'Economía y finanzas', en: 'Economy and finance' },
  { id: 'population-social', es: 'Población y condiciones sociales', en: 'Population and social conditions' },
  { id: 'industry-trade-services', es: 'Industria, comercio y servicios', en: 'Industry, trade and services' },
  { id: 'agriculture-fisheries', es: 'Agricultura, silvicultura y pesca', en: 'Agriculture, forestry and fisheries' },
  { id: 'international-trade', es: 'Comercio internacional de bienes', en: 'International trade in goods' },
  { id: 'transport', es: 'Transporte', en: 'Transport' },
  { id: 'environment-energy', es: 'Medio ambiente y energía', en: 'Environment and energy' },
  { id: 'science-digital', es: 'Ciencia, tecnología y sociedad digital', en: 'Science, technology, digital society' },
]
