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
- **Catalogue Service** ✅ **T04** (`catalogueService.ts` + generador
  `scripts/build-catalogue-index.mjs`): la Catalogue API no tiene CORS
  (puerta T00) → índice estático versionado generado en build desde el TOC
  (10.408 entradas; 276 KB gzip; `prebuild` lo regenera con red de
  seguridad). Búsqueda normalizada, temas, metadatos del TOC (RF-01/22).
- **Schema Service** ✅ **T05** (`schemaService.ts`): esquema SOLO desde
  SDMX 2.1 (datastructure + content constraint, decisión T00) →
  `DatasetSchema` versionado; presupuesto de celdas previo (C5, 200.000)
  y selección inicial segura (RF-06). Etiquetas de categoría = código en
  esta capa; el nombre legible llega de la respuesta JSON-stat (T03) y
  del diccionario ES (T14).
- **Geo Service** (T10): Nuts2json/GISCO por (año NUTS, nivel, escala).
- **ES Dictionary Service** (T14): traducción ES de etiquetas (§2.1).
- **Freshness Service** (T13): probe de `updated`, agenda 11:00/23:00 Brussels.
