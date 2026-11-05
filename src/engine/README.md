# Capa de motor (SDD §4.2)

Reservado en T01. Aquí vivirán, como funciones puras y testeables:

- **Pivot Engine** ✅ **T06** (`pivotEngine.ts`): `filas tidy + esquema + spec
  → PivotTable`. Función pura; repivotar nunca llama a la red (C4); celda
  ausente = `null`, nunca 0; dimensión no colocada con varios valores =
  error de ambigüedad explícito, no una mezcla silenciosa.
- **Derived Metrics Engine** ✅ **T06b** (`derivedMetrics.ts`): agregados,
  Δ%/Δpp, CAGR, índice-100, ranking con periodo común, referencia UE oficial
  y frase-resumen ES — todo gobernado por `validOps` de la ficha (C13,
  RF-27/28/29/32/33). Operación desactivada = `ok: false` con el motivo de
  la ficha, nunca un número sustituto en silencio.

Ningún componente de UI consume JSON-stat crudo: todo pasa por la tabla tidy (C3).
