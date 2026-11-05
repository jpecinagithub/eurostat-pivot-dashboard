# Capa de servicios (SDD §4.2)

Reservado en T01 (las constantes oficiales están en `eurostat.ts`). Aquí vivirán:

- **Eurostat Client** (T02): buildQuery, presupuesto de celdas, fetch serializado
  por dataset, errores tipados 100/140/150/413/500.
- **Catalogue Service** (T04): TOC/metabase cacheados, búsqueda, árbol de temas.
- **Schema Service** (T05): content constraint/DSD → `DatasetSchema` versionado.
  La vía (directa desde navegador vs índice estático de build) la decide la
  puerta **T00** (§4.5).
- **Geo Service** (T10): Nuts2json/GISCO por (año NUTS, nivel, escala).
- **ES Dictionary Service** (T14): traducción ES de etiquetas (§2.1).
- **Freshness Service** (T13): probe de `updated`, agenda 11:00/23:00 Brussels.
