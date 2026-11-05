import { describe, expect, it } from 'vitest'
import { DEFAULT_UI_LANG, en, es, t } from './dictionaries'

describe('i18n de cáscara (RNF-01, T01)', () => {
  it('el idioma por defecto es español (decisión §3.12)', () => {
    expect(DEFAULT_UI_LANG).toBe('es')
  })

  it('EN y ES tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('ninguna traducción está vacía', () => {
    for (const dict of [es, en]) {
      for (const value of Object.values(dict)) {
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('t() resuelve en el idioma pedido', () => {
    expect(t('es', 'nav.themes')).toBe('Temas')
    expect(t('en', 'nav.themes')).toBe('Themes')
  })
})
