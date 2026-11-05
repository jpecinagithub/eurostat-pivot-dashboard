# Capa de motor (SDD §4.2)

Reservado en T01. Aquí vivirán, como funciones puras y testeables:

- **Pivot Engine** (T06): `TidyTable + PivotSpec → PivotTable / Series / MapData / KPI`.
  Repivotar nunca llama a la red (C4).
- **Derived Metrics Engine** (T06b): media/mediana/min/max/Δ%/Δpp/CAGR/índice-100,
  referencia UE y frase-resumen ES — gobernado por `validOps` de la ficha del
  dataset (C13, RF-27/28/32/33).

Ningún componente de UI consume JSON-stat crudo: todo pasa por la tabla tidy (C3).
