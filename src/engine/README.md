# Capa de motor (SDD §4.2)

Reservado en T01. Aquí vivirán, como funciones puras y testeables:

- **Pivot Engine** ✅ **T06** (`pivotEngine.ts`): `filas tidy + esquema + spec
  → PivotTable`. Función pura; repivotar nunca llama a la red (C4); celda
  ausente = `null`, nunca 0; dimensión no colocada con varios valores =
  error de ambigüedad explícito, no una mezcla silenciosa.
- **Derived Metrics Engine** (T06b): media/mediana/min/max/Δ%/Δpp/CAGR/índice-100,
  referencia UE y frase-resumen ES — gobernado por `validOps` de la ficha del
  dataset (C13, RF-27/28/32/33).

Ningún componente de UI consume JSON-stat crudo: todo pasa por la tabla tidy (C3).
