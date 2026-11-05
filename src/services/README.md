# Capa de servicios (SDD §4.2)

Las constantes oficiales están en `eurostat.ts`.

- **Eurostat Client** ✅ **T02** (`eurostatClient.ts`): buildQuery canónica,
  errores tipados 100/140/150, 413 separado en «en preparación» / «demasiado
  grande», 500/red, y fetch serializado por dataset. (El presupuesto de
  celdas es T05.)
- **Parser JSON-stat** ✅ **T03** (`jsonstatParser.ts`): JSON-stat 2.0 → tabla
  tidy (jsonstat-toolkit + strides); ausencia ≠ 0; status como columna con
  textos de la propia respuesta. Ojo: `OBS_COUNT` es el total del dataset
  completo, no de la extracción. Aquí vivirán además:
- **Catalogue Service** (T04): TOC/metabase cacheados, búsqueda, árbol de temas.
- **Schema Service** (T05): content constraint/DSD → `DatasetSchema` versionado.
  La vía (directa desde navegador vs índice estático de build) la decide la
  puerta **T00** (§4.5).
- **Geo Service** (T10): Nuts2json/GISCO por (año NUTS, nivel, escala).
- **ES Dictionary Service** (T14): traducción ES de etiquetas (§2.1).
- **Freshness Service** (T13): probe de `updated`, agenda 11:00/23:00 Brussels.
