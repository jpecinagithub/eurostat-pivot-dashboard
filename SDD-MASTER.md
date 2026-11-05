# EUROPIVOT — Dashboard Eurostat tipo Pivot Table
## Plan de trabajo SDD para ejecutar con Muse
**Autor:** Jon Peciña — jpecina@gmail.com · **Fecha SDD:** 2026-11-05 · **Estado:** CERRADO Y APROBADO 2026-11-05 — las 7 decisiones de §3.12 están tomadas por Jon; sin aclaraciones abiertas. Implementación no arranca sin orden expresa
**Ajuste v2.1 (2026-11-05):** el codec de URL para **compartir un solo panel** se adelanta de T11 a **T09b/M1** (M1 lo necesita para su prueba en otro navegador); T11 amplía ese mismo mecanismo a dashboards multipanel, sin duplicar trabajo ni romper los enlaces de M1.
**Revisión v2 (2026-11-05, revisión de Jon antes de ejecutar):** proyecto aprobado manteniendo las decisiones de producto. Se incorporan 5 cambios en orden de prioridad (§7): ① reglas de cálculo por indicador/unidad/dimensión, ② revisión del pack con ficha mínima antes de traducir, ③ prueba temprana de arquitectura sin backend en navegador real, ④ contrato de consultas/refresco corregido, ⑤ hito demostrable de comparación adelantado. Si solo se pudieran hacer dos: ① y ③.
**Investigación base:** Análisis profundo API Eurostat 2026-11-05 (fuentes oficiales ec.europa.eu/eurostat, verificación en vivo Statistics API)

---

# 0. RESUMEN EJECUTIVO — QUÉ SE CONSTRUYE Y POR QUÉ

Eurostat no tiene una API: tiene **4 APIs REST oficiales sin autenticación** + Bulk Download + GISCO.
Este proyecto construye un dashboard web donde el usuario:

1. Entra a una **home por servicios/temas** (9 temas oficiales Eurostat).
2. Elige un dataset curado o busca entre ~10.000 productos del catálogo.
3. En un **constructor tipo pivot table** arrastra dimensiones a Filas / Columnas / Filtros, cambia selectores y la vista (tabla, gráfico, mapa, KPI) **se actualiza automáticamente**.
4. **Compara países en 1 clic y saca medias sin fórmulas** (prioridad nº1, C0): referencia UE, media/mediana/variaciones calculadas y rotuladas, y una frase-resumen en español por panel.
5. Mezcla paneles de **datasets distintos en un mismo dashboard**, todo **en español**, **sin backend**, con **mapas en v1** y export a **Excel/CSV/PNG** (decisiones §3.12).
6. Guarda su configuración, la comparte por URL y exporta.

**Decisión central (evidencia):** Statistics API es la única pensada para visualización en navegador — JSON-stat 2.0, CORS oficial, sin clave. SDMX 3.0/2.1 queda para metadatos (DSD, codelists, content constraint). Catalogue API para descubrimiento. GISCO/Nuts2json para mapas. No hay tiempo real ni webhooks: Eurostat actualiza **2×/día (11:00 y 23:00 Europe/Brussels)** — la "actualización automática" del producto es *polling* de `updated` + refresco programado, nunca "real time" en la UI.

---

# 1. CONSTITUCIÓN (principios no negociables)

**C0 — Utilidad e interpretabilidad primero (prioridad nº1, dicha por Jon 2026-11-05).** El producto no triunfa por tener más datos, sino porque la información sea **útil y fácil de interpretar**: comparar países entre sí debe costar 1 clic, sacar una media debe costar 0 fórmulas, y cada panel debe poder leerse en 10 segundos (qué mide, en qué unidad, qué periodo, frente a qué referencia). Toda decisión de diseño que choque con C0 pierde contra C0.
**C1 — La spec manda.** Ningún código sin RF que lo cubra. Todo RF se valida con test o recorrido real.
**C2 — Sin literales de dataset en el motor.** El motor pivot es genérico: ningún código de dataset, dimensión o valor hardcodeado en la lógica. Los datasets curados viven en datos de configuración, no en código.
**C3 — Tidy primero.** Todo JSON-stat se convierte a tabla tidy (`dataset, dim_1..dim_n, time, value, status`) antes de tocar la UI. Ningún componente consume JSON-stat crudo.
**C4 — Repivotar ≠ re-consultar.** Cambiar filas/columnas/orden con el mismo conjunto de filtros NO vuelve a llamar a la API. Solo un cambio de filtros dispara una nueva extracción.
**C5 — Presupuesto antes de consultar.** Antes de lanzar una query se calcula Π cardinalidades seleccionadas. Si supera el umbral interactivo (200.000 celdas), se obliga a filtrar más. Nunca lanzar y "ver qué pasa" contra el límite oficial de 5.000.000 filas (fault 413).
**C6 — Fair use Eurostat.** Máx. 1 extracción en vuelo por dataset, sin paralelismo en barridos, caché compartida por URL canónica. Respetar la política oficial aunque sus umbrales no estén publicados.
**C7 — `unit` es dato, no formato.** Cambiar `unit` cambia la serie y su significado. Siempre visible junto al título del panel.
**C8 — `status` es columna, no adorno.** Flags (`e` estimado, `p` provisional, `b` ruptura…) viajan como columna propia, se renderizan como superíndice/tooltip con texto de `extension.status.label` y son filtrables. Nunca hardcodear el alfabeto de flags (cambió el 2025-01-27).
**C9 — Sin inventar estructura.** Dimensiones, posiciones y etiquetas salen del content constraint / DSD / propia respuesta del dataset, nunca de listas escritas a mano.
**C10 — Honestidad de frescura.** Cada panel muestra `updated` del dataset y fuente Eurostat + código/DOI. Prohibido prometer "tiempo real".
**C11 — Specs permanentes de Jon (2026-10-04) + excepción EUROPIVOT (2026-11-05):** bilingüe EN/ES pero **en este proyecto ES por defecto y todo en ES** (decisión expresa de Jon, como excepción a la regla general EN), responsive, PWA (manifest + iconos + SW, offline donde sea viable), Vercel Analytics vía `@vercel/analytics` (código sí, activación en dashboard la hace Jon), referencia breve de autor con jpecina@gmail.com.
**C12 — Licencia.** Reutilización Eurostat con atribución obligatoria en cada vista/export. Fronteras GISCO © EuroGeographics: revisar condiciones de la capa concreta antes de uso comercial.
**C13 — Ningún cálculo sin regla escrita (v2).** Una comparación puede cargar, dibujarse y exportarse siendo estadísticamente incorrecta (sumar porcentajes, comparar años distintos): ese es el riesgo principal del producto. Por tanto, **qué operaciones tienen sentido lo decide la configuración del pack curado — por dataset, indicador, unidad y dimensión — no el motor ni el azar de la UI**. El motor pivot/derivados sigue siendo genérico (C2): lee `validOps` de la ficha del dataset (§3.13) y ofrece solo esas operaciones; lo no permitido se desactiva con explicación, nunca se calcula en silencio. Las reglas viven en datos revisables por separado del código.
**C14 — Ningún dataset curado sin ficha verificada (v2).** Que la API devuelva datos no prueba que el dataset sea el correcto: Eurostat mantiene datasets discontinuados que siguen respondiendo con su histórico. Todo dataset del pack exige ficha mínima (§3.13) verificada contra metadatos oficiales antes de diseñar tarjetas o traducir sus categorías.

---

# 2. ANÁLISIS API EUROSTAT — SÍNTESIS VERIFICADA (2026-11-05)

## 2.1 Las 6 superficies

| Superficie | Base | Uso en este producto | Auth | Formato |
|---|---|---|---|---|
| **Statistics API** | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{code}` | **Datos interactivos del pivot** | Ninguna | JSON-stat 2.0 (solo JSON) |
| Statistics Comext | `https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/{DS-*}` | Solo datasets `DS-`, siempre filtrados | Ninguna | JSON-stat 2.0 |
| **SDMX 3.0** | `https://ec.europa.eu/eurostat/api/dissemination/sdmx/3.0/` | Metadatos nuevos, ETL, CSV 2.0 | Ninguna | SDMX-ML, SDMX-CSV 2.0, JSON-stat, TSV |
| **SDMX 2.1** | `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/` | DSD, codelists, content constraint, TSV bulk | Ninguna | SDMX-ML, SDMX-CSV 1.0, JSON-stat, TSV |
| **Catalogue API** | `https://ec.europa.eu/eurostat/api/dissemination/catalogue/` | TOC, DCAT, RSS, metabase | Ninguna | XML, TXT, RDF, RSS, TXT.GZ |
| **GISCO** | `https://gisco-services.ec.europa.eu/distribution/v2/` + Nuts2json | Geometrías NUTS para coropléticas | Ninguna | GeoJSON / TopoJSON |

CORS: Statistics API lo soporta oficialmente → fetch directo desde navegador viable. BFF/proxy solo se justifica por caché/fair use, no por CORS. CORS de SDMX no está afirmado en la guía: no basar el front en llamadas SDMX directas sin probarlo (vía BFF o vía Statistics para descubrir esquema).

Idiomas API: solo **EN/FR/DE**. No hay español en etiquetas — y Jon ha decidido **todo ES por defecto** (§3.12). Consecuencia técnica obligatoria: EUROPIVOT pide los datos con `lang=EN` (fuente estable) y aplica encima su **capa de traducción ES propia** (servicio de diccionario, §4.2): cáscara, nombres de los 9 temas, dimensiones genéricas, y las codelists de los datasets curados (geo con nombres de países/regiones en español, sex, age, unit, freq y las dimensiones propias de cada dataset del pack). Fuera del pack curado, si una categoría no tiene traducción en el diccionario, se muestra la etiqueta oficial EN sin bloquear la vista y se registra como hueco de diccionario a completar — nunca se inventa una traducción automática en caliente. Ampliar el diccionario es una tarea de datos (JSON versionado), no de código (C2).

## 2.2 Statistics API — contrato que debe implementar el cliente

- Plantilla: `{base}/{datasetCode}?format=JSON&lang=EN&{DIM}={VALUE}...`
- Filtro por dimensión: parámetro repetible, case-insensitive. Sin filtrar una dimensión = todas sus posiciones (causa nº1 de respuestas gigantes).
- Tiempo (solo UN tipo por query, salvo since+until combinables): `time=`, `sinceTimePeriod=`, `untilTimePeriod=`, `lastTimePeriod=N`.
- `geoLevel=aggregate|country|nuts1|nuts2|nuts3|city` — excluyente con `geo=` (juntos = error 400/150).
- Errores: 100 sin resultados (400/404), 140 sintaxis (400), 150 semántico (400), **413 asíncrono / EXTRACTION_TOO_BIG >5.000.000 filas estimadas**, 500.
- Ejemplo verificado en vivo: `GET /statistics/1.0/data/DEMO_R_D3DENS?lang=EN` → JSON-stat 2.0, `updated 2026-02-25T23:00:00+0100`, `id [freq,unit,geo,time]`, `size [1,1,2031,35]`, 57.129 obs.

## 2.3 JSON-stat 2.0 — aplanado (algoritmo obligatorio)

Campos: `id[]` orden de dimensiones, `size[]` cardinalidades, `dimension.<dim>.category.index` código→posición, `category.label` código→etiqueta, `value` disperso `{índice_plano: número}` (ausencia = sin dato, ≠0), `status` disperso con misma indexación, `extension.annotation[]` (OBS_COUNT, OBS_PERIOD_OVERALL_LATEST/OLDEST, DISSEMINATION_TIMESTAMP_PLANNED, UPDATE_DATA/STRUCTURE, ESMS_HTML).

```
flat = (((i0 × size[1] + i1) × size[2] + i2) × …) + i_last   // row-major, última dimensión varía más rápido
stride[k] = Π size[k+1..n-1]  // inversa para descomponer flat en índices por dimensión
```
Reglas: iterar claves presentes en `value`, no Πsize; aceptar `value` como objeto o array; conservar `status` separado.

Parser JS de referencia: **jsonstat-toolkit** (npm) + **jsonstat-euro** para queries/extension Eurostat. No existe cliente TS oficial Eurostat: tipos propios generados/declarados. Mapas: **eurostat-map** (oficial) + Nuts2json.

## 2.4 Catálogo y descubrimiento

| Mecanismo | Endpoint | Uso |
|---|---|---|
| TOC XML | `/catalogue/toc/xml` | Árbol de temas del selector |
| TOC TXT | `/catalogue/toc/txt?lang=en` | Búsqueda código↔título |
| DCAT FULL / UPDATES | `/catalogue/dcat/ESTAT/FULL` · `/UPDATES` | Catálogo completo / solo modificados |
| Metabase | `/catalogue/metabase.txt.gz` | Inventario `dataset ⭾ dimensión ⭾ posición` de TODO Eurostat → precargar modelo de filtros |
| RSS | `/catalogue/rss/en/statistics-update.rss` | Novedades |

Magnitud: ~10.319 productos en espejo del TOC oficial (2026-10-19, secundario); conteo exacto no verificable (mezcla datasets, vistas `tec*/tips*/sdg_*` y carpetas). Diseño seguro: ~10⁴ productos, varios miles de datasets detallados. **9 temas oficiales:** 1 General/regional, 2 Economía y finanzas, 3 Población y social, 4 Industria/comercio/servicios, 5 Agricultura/pesca, 6 Comercio internacional, 7 Transporte, 8 Medio ambiente y energía, 9 Ciencia/tecnología/sociedad digital.

## 2.5 Detección de cambios (no hay push)

Polling ligero con `lastTimePeriod=1` → comparar `updated` + `annotation[PLANNED]` → programar siguiente refresco tras 11:00/23:00 Brussels; complementar con DCAT UPDATES y RSS. SDMX 3.0: `updatedAfter` / `If-Modified-Since`.

## 2.6 Caché (política obligatoria)

| Capa | Política |
|---|---|
| TOC + metabase | Larga, refresco 2×/día tras 11:00/23:00 Brussels |
| DSD + codelists versionadas | Casi permanente, clave agencia/id/versión |
| Content constraint + dataflow | Corta, revalidación diaria (no versionados) |
| Geometrías GISCO/Nuts2json (año NUTS, nivel, escala, EPSG) | Permanente versionada; usar 20M/60M, nunca 01M por defecto |
| Respuestas JSON-stat | Por URL canónica completa, TTL alineado al ciclo 11:00/23:00 o invalidación por `updated` |
| Layout pivot del usuario | Cliente (localStorage) + URL compartible; no es dato, no se cachea como dato |

## 2.7 Datasets de arranque verificados (pack curado v1 — 20)

Economía: `nama_10_gdp` (A, freq/unit/na_item/geo/time), `namq_10_gdp` (Q), `nama_10_pc` (A), `tec00114` vista PIB per cápita PPS (A), `gov_10dd_edpt1` déficit/deuda (A).
Precios ⚠️ **REVISAR ANTES DE USAR (v2, verificado 2026-11-05 contra ESMS oficiales): las tres entradas actuales son familia ECOICOP v1 (histórica).** Desde febrero de 2026 el IPCA vigente usa **ECOICOP v2, base 2025=100**: `prc_hicp_midx` (M, índice v1, cobertura histórica hasta 2025) → sucesora **`prc_hicp_minr`** (M, v2); `prc_hicp_aind` (A, v1) → sucesora **`prc_hicp_ainr`** (A, v2); `prc_hicp_manr` (M, tasa anual v1) → sucesora a confirmar en su ficha dentro de la familia v2. La API sigue devolviendo datos de las series v1: una prueba de «devuelve datos» NO las valida (C14). El pack de arranque usará las sucesoras v2 salvo que la ficha justifique lo contrario.
Población: `demo_pjan` (A, age/sex), `demo_gind` (A), `demo_r_d3dens` (A, NUTS3, verificado en vivo).
Empleo/social: `une_rt_m` paro mensual (M, s_adj/age/sex), `lfsa_ergaed` empleo por educación (A, isced11), `ilc_li02` riesgo pobreza (A), `ilc_peps01n` AROPE (A).
Región: `nama_10r_2gdp` PIB regional NUTS2 (A).
Energía/ambiente/digital/SDG: `nrg_bal_c` balances energía (A, siec), `env_wat_res` agua (A), `isoc_ci_in_h` internet hogares (A), `sdg_08_10` vista SDG PIB per cápita real (A).
⚠️ Antes de programar contra cada uno: confirmar DSD con su content constraint. Certeza diferenciada en informe completo (8/13/16/20 apoyados también en secundarios).

Dimensiones típicas: `freq` A/Q/M, `geo` (EL≠GR, UK≠GB; agregados fechados EU27_2020/EA20…; NUTS por longitud 2/3/4/5), `time`, `unit` (CP_MEUR, CLV10_EUR, PC_GDP, PPS_EU27_2020_HAB…), `sex` T/M/F, `age`, `isced11`, `na_item` (B1GQ=PIB), `coicop`, `nace_r2`, `siec`, `s_adj`. ⚠️ Las unidades son **por dataset** (C9): verificado en vivo al construir la página de análisis (2026-11-05) que en `nama_10_gdp` **no existe `CLV10_EUR`** — la unidad de volúmenes encadenados vigente ahí es `CLV20_MEUR`, y la API descarta en silencio los códigos inexistentes. Por eso ningún ejemplo de este SDD sustituye a validar contra el content constraint del dataset concreto.

## 2.8 Riesgos (registro vivo)

413/fair use por query ambiciosa → serializar, cola, backoff, mensaje "acota filtros o descarga TSV". Vacío ≠ error de red (fault 100) → validar códigos contra constraint. Cambio de DSD/NUTS a mitad de vida → revalidación diaria, fail-soft del filtro. Agregados engañosos → nunca normalizar EU27_2007→EU27_2020, join mapas por código literal. Sin SLA/rate limit publicado → caché agresiva + snapshots de datasets core. Deprecaciones: wdds muerto (feb-2023), Bulk Listing retirado (oct-2023), RAMON retirado (jun-2023), flags partidos Obs/Conf (ene-2025). SDMX 2.1 sin fecha de retirada verificada: código nuevo = Statistics + SDMX 3.0.

---

# 3. SPEC — REQUISITOS FUNCIONALES (EARS)

Formato: `Cuando <evento>, el sistema deberá <respuesta observable>.` · Spec cerrada 2026-11-05: no quedan aclaraciones abiertas (§3.12).

## 3.1 Usuarios e historias
- **Analista/explorador:** "Quiero comparar el PIB per cápita de ES/FR/DE en los últimos 10 años como tabla, gráfico y mapa sin escribir código."
- **Curioso/estudiante:** "Quiero entrar, ver los temas, y en 2 clics tener un gráfico que entienda."
- **Reutilizador:** "Quiero guardar mi vista, compartirla por enlace y exportar CSV con fuente citada."

## 3.2 Home / Dashboard inicial
- **RF-01** Cuando el usuario abra la app, el sistema deberá mostrar una home con acceso a los 9 temas Eurostat y a los datasets destacados del pack curado, cada tarjeta con título, código, frecuencia y fecha `updated`. **Corrección v2:** la fecha saldrá **primero de los metadatos** (ficha §3.13 / Catalogue / DCAT), que no cuesta extracción; solo cuando no haya fecha en metadatos se hará probe de datos, y será una **selección pequeña con presupuesto calculado** (p. ej. un agregado, un periodo), nunca `lastTimePeriod=1` a secas — ese parámetro limita el tiempo pero deja abiertas las demás dimensiones y puede disparar extracciones grandes por tarjeta.
- **RF-02** Cuando un probe de `updated` falle, el sistema deberá mostrar la tarjeta sin fecha (no bloquear la home ni mostrar fecha inventada).
- **RF-03** Cuando el usuario busque texto, el sistema deberá buscar sobre el TOC cacheado (código + título) y llevar al constructor con ese dataset preseleccionado.

## 3.3 Descubrimiento y esquema del dataset
- **RF-04** Cuando el usuario seleccione un dataset, el sistema deberá cargar su esquema (dimensiones, posiciones reales vía content constraint o respuesta acotada, etiquetas) sin listas hardcodeadas.
- **RF-05** Cuando el esquema cambie respecto a la versión cacheada, el sistema deberá degradar los filtros afectados (fail-soft) y avisar, sin romper vistas guardadas.
- **RF-06** Cuando el usuario abra un dataset, el sistema deberá aplicar una selección inicial segura: últimos 10 periodos (`lastTimePeriod=10` o equivalente), `geoLevel=country` si geo es masiva, y una sola `unit` por defecto documentada.

## 3.4 Constructor Pivot (núcleo)
- **RF-07** Cuando el usuario arrastre una dimensión entre Filas, Columnas y Filtros, el sistema deberá repivotar en cliente sin nueva llamada a la API si el conjunto de filtros no cambió.
- **RF-08** Cuando cambie cualquier filtro (valores de dimensión, rango temporal, unit), el sistema deberá recalcular el presupuesto de celdas y, si es ≤ umbral, lanzar una sola extracción y actualizar todos los paneles vinculados. **Corrección v2 — subconjunto vs ampliación:** si el cambio **reduce** la selección a un subconjunto de lo ya descargado (p. ej. ya están ES/FR/DE y el usuario oculta DE), el sistema deberá aplicar el cambio **al instante y con cero peticiones** filtrando la tidy en memoria; solo si el cambio **añade** valores no descargados (un país que falta, más periodos, otra unit) podrá lanzarse una extracción. La prueba de aceptación distinguirá ambos casos contando peticiones de red.
- **RF-09** Cuando el presupuesto supere 200.000 celdas, el sistema deberá bloquear la extracción, explicar qué dimensión dispara el tamaño y sugerir el filtro concreto que más reduce.
- **RF-10** Cuando la extracción sea grande, el sistema deberá distinguir **dos estados del servidor que hoy están mezclados**: (a) **«extracción en preparación»** — franja asíncrona documentada por Eurostat: por debajo de ~500.000 celdas estimadas la respuesta es síncrona, **entre ~500.000 y 5.000.000 Eurostat la prepara en segundo plano** (clave + polling a `/1.0/async/status/{id}`); la UI muestra progreso y recupera el dato al estar disponible; (b) **«extracción demasiado grande»** — **más de 5.000.000 → fault 413 `EXTRACTION_TOO_BIG`**: acción de acotar filtros o descargar TSV, sin reintentos en bucle. El límite propio interactivo de **200.000 celdas (C5) se mantiene** por encima de ambos: en uso normal la UI bloquea antes de entrar en la franja asíncrona. Ambos estados se probarán **por separado** (T15).
- **RF-11** Cuando la selección no tenga datos (fault 100 o `value` vacío), el sistema deberá mostrar "sin datos para esta selección" diferenciado de un error de red/servicio.
- **RF-12** El sistema deberá ofrecer selectores por dimensión con: búsqueda, multi-selección, seleccionar nivel (geoLevel para geo), presets temporales (últimos 5/10/todo, rango since–until) y contador de valores seleccionados.
- **RF-13** Cuando el usuario cambie `unit`, el sistema deberá tratarlo como cambio de filtro (nueva extracción si aplica) y mostrar siempre la etiqueta completa de unit junto al título del panel.
- **RF-14** El sistema deberá mostrar los flags `status` como superíndice con tooltip (texto oficial) y ofrecer filtro "ocultar estimados/provisionales".

## 3.5 Visualizaciones (paneles vinculados a un mismo estado pivot)
- **RF-15** El sistema deberá renderizar el mismo estado pivot como: tabla pivot (filas×columnas, totales opcionales), gráfico de líneas, gráfico de barras, ranking y tarjeta KPI (último periodo).
- **RF-16** Cuando `geo` esté en filas o filtro con nivel NUTS/país y exista geometría para la versión NUTS fijada, el sistema deberá ofrecer mapa coroplético con join por código `geo` literal; los agregados (EU27_2020…) quedan fuera del mapa y listados aparte.
- **RF-17** Cuando el usuario añada un panel al dashboard, el sistema deberá permitir elegir tipo de visualización, título editable y tamaño en una rejilla responsive. **Decisión Jon 2026-11-05: en v1 un mismo dashboard mezcla paneles de datasets distintos.** Cada panel guarda su propio `PivotSpec` completo (dataset, filtros, filas/columnas) y es independiente: cambiar un panel no altera los demás.
- **RF-18** Cuando el usuario reordene/redimensione paneles, el sistema deberá persistir el layout automáticamente.

## 3.6 Comparación e interpretación (prioridad C0 — el corazón del producto)
- **RF-25 Comparar países en 1 clic.** Cuando el usuario esté en cualquier panel con dimensión `geo`, el sistema deberá ofrecer: (a) selector rápido de países con buscador y chips de seleccionados; (b) presets de datos de configuración — «UE-27», «Zona euro», «España y vecinos» (ES/FR/PT/IT/DE), «Todos los países» vía `geoLevel=country`; (c) modo comparación lado a lado: misma tabla/gráfico con un país por serie y colores estables por país en todo el dashboard.
- **RF-26 Referencia UE siempre a mano.** Cuando exista agregado oficial en el dataset (p. ej. `EU27_2020`), el sistema deberá poder fijarlo como **referencia**: línea de referencia en gráficos, columna «vs UE» en tablas y distancia en panel KPI. El agregado oficial es un dato Eurostat, no un cálculo propio, y se etiqueta como tal.
- **RF-27 Medias y cálculos derivados sin fórmulas — solo donde tienen sentido.** El sistema deberá calcular en cliente, sobre la tabla tidy ya descargada (sin nueva llamada a la API), las operaciones que la **ficha del dataset declare válidas para ese indicador, unidad y dimensión** (`validOps`, §3.13, C13): según la ficha podrán ser **media del periodo, mediana, mínimo, máximo, último valor, variación interanual (%), variación en puntos porcentuales, crecimiento acumulado/CAGR, índice base 100 y posición en el ranking**. Una operación no declarada no se ofrece. Cada cálculo mostrará su fórmula en lenguaje llano al pasar el ratón («Media = suma de los valores del periodo ÷ nº de periodos con dato»).
- **RF-28 Agregado oficial vs cálculo propio — etiqueta corregida (v2).** La etiqueta general del dato oficial será **«agregado oficial de la UE»** (o del agregado que sea: zona euro, etc.). Las palabras «media» y cualquier descripción de ponderación **solo** se usarán cuando la metodología del indicador, según su ficha/metadatos ESMS, diga que el agregado es efectivamente una media y cómo pondera; en caso contrario no se describe como media. Frente a él, el cálculo propio se rotula «Media simple calculada por EUROPIVOT (sin ponderar) — no es el agregado oficial». Esta distinción se aplica igual en tabla, gráfico, export **y en la frase-resumen de RF-29**, porque esa frase es la que el usuario puede acabar citando.
- **RF-32 Reglas de cálculo ante intentos concretos (v2, casos obligatorios de test).**
  | Si el usuario intenta… | EUROPIVOT deberá… |
  |---|---|
  | Obtener un **total** de tasas de paro (u otra tasa/%) de varios países | Desactivar la suma para esa unidad; ofrecer el **agregado oficial de la UE** si existe en el dataset, o la **media simple** de los seleccionados con su etiqueta RF-28 |
  | Comparar una tasa que pasa del 5 % al 6 % | Mostrar **+1 punto porcentual** para la diferencia y **+20 %** para la variación relativa, dejando claro cuál de las dos operaciones está viendo; nunca mezclarlas en una misma cifra |
  | Ordenar/ranking de países cuando uno carece de dato para 2025 | Usar un **periodo común** a los países comparados y señalar explícitamente qué países quedan fuera por falta de dato; un valor de 2024 **nunca** entra en silencio en el ranking de 2025 |
  | Crear un índice base 100 con valor inicial cero o ausente | No calcular el índice, explicar por qué («el periodo base no tiene valor / es cero») y permitir elegir otro periodo base |
  | Sumar/totalizar cualquier unidad declarada no sumable en la ficha (índices, %, per cápita, PPS…) | Desactivar «Total» en el pivot para esa unidad y explicar la regla con la frase de la ficha |
- **RF-33 Periodo común en toda comparación (v2).** Toda comparación entre países (tabla, gráfico, ranking, frase-resumen) deberá usar el mismo periodo para todos; si las series no coinciden, el sistema recorta al periodo común disponible o excluye con aviso a la serie sin dato — nunca compara silenciosamente países de años distintos.
- **RF-29 Lectura en 10 segundos.** Cada panel deberá mostrar bajo el título una **frase-resumen automática en español** generada de los datos visibles (plantillas, no LLM): qué lidera, qué país va último, y la distancia del país fijado frente a la referencia — p. ej. «En 2024, Irlanda lidera (…). España está 3,2 puntos por debajo de la media UE.» Si no hay referencia ni ranking posible, la frase se limita a último valor y variación. La frase nunca afirma causalidad.
- **RF-30 Normalizar para comparar justo.** Cuando el dataset lo permita vía `unit`, el sistema deberá sugerir activamente la unidad comparable (per cápita, % del PIB, PPS o índice) al comparar países de distinto tamaño, y ofrecer «Índice base = 100» (re-basear la serie al primer periodo seleccionado) como transformación en cliente.
- **RF-31 Contexto mínimo obligatorio.** Todo panel mostrará siempre, sin que el usuario lo pida: unidad completa, periodo cubierto, nº de países/series visibles, fecha `updated` y aviso de provisionales/estimados si hay flags activos. Un número sin ese contexto se considera defecto (C0).

## 3.7 Persistencia, compartir, exportar
- **RF-19** El sistema deberá guardar dashboards en localStorage (sin backend en v1, decisión §3.12) con nombre, y por cada panel su dataset, filtros, layout pivot y tipo de visualización, más fecha de guardado.
- **RF-20** Cuando el usuario comparta, el sistema deberá generar una URL con la especificación completa del dashboard (todos los paneles) codificada, reproducible en otro navegador sin cuenta. **Aclaración v2 — enlace vivo:** el enlace reproduce la **configuración**, no una foto de las cifras: al abrirlo se consultan los datos vigentes, que **pueden ser cifras revisadas por Eurostat** desde que se compartió. La UI lo dirá junto al botón de compartir («El enlace muestra siempre los datos más recientes de Eurostat»). **Entrega en dos pasos (ajuste v2.1):** en **T09b/M1** se implementa el codec de URL para **un solo panel** (un `PivotSpec` completo); en **T11** el mismo codec se amplía a la colección de paneles del dashboard. El formato lleva versión y T11 deberá seguir abriendo los enlaces de un panel generados en M1.
- **RF-21** Cuando el usuario exporte, el sistema deberá ofrecer **CSV/TSV, Excel (.xlsx) y PNG** (decisión §3.12): CSV/TSV de la tabla tidy y del pivot visible; **Excel con dos hojas — «Datos» (tidy) y «Pivot» (vista actual, con los cálculos derivados de RF-27 ya materializados y rotulados)**; PNG del gráfico/mapa. Todo export incluye la cita `Fuente: Eurostat, [código], [fecha de acceso]`, la unidad y nota de modificaciones/cálculos propios si aplica. **Aclaración v2 — export = foto fija:** a diferencia del enlace (RF-20), el Excel/CSV conserva **los valores tal como estaban en el momento de exportar**, con su fecha de exportación y el `updated` del dataset grabados en el propio fichero; si Eurostat revisa después, el fichero no cambia — y eso es lo que lo hace citable.

## 3.8 Actualización automática y frescura
- **RF-22** Cuando un dashboard guardado o abierto cumpla su ciclo de refresco, el sistema deberá comprobar `updated` **primero vía metadatos** (como RF-01 v2) y solo si cambió — o si no hay metadato — hacer probe de datos con selección pequeña presupuestada; solo si el `updated` cambió, re-extraerá y marcará los paneles como actualizados con la nueva fecha. Abrir la portada o refrescar **nunca** disparará una batería de consultas sin presupuesto a los datasets destacados.
- **RF-23** El sistema deberá programar los probes alineados al ciclo Eurostat (tras 11:00 y 23:00 Europe/Brussels) y nunca prometer tiempo real en la UI.
- **RF-24** Cuando el usuario esté interactuando (arrastrando/editando), el sistema deberá posponer la aplicación del refresco hasta que termine la interacción, avisando de que hay datos nuevos disponibles.

## 3.9 Plataforma (no funcionales)
- **RNF-01** **Todo en español por defecto** (decisión §3.12): UI, cáscara, temas, dimensiones y categorías del pack curado en ES mediante la capa de diccionario de §2.1; EN disponible como idioma alternativo completo de cáscara. La petición a la API se hace en EN y la traducción se aplica en cliente.
- **RNF-02** Responsive completo y PWA instalable con offline para cáscara + últimos datos cacheados.
- **RNF-03** Vercel Analytics integrado por código; despliegue Vercel lo hace Jon (regla Vercel: el agente no despliega sin orden expresa de una tarea).
- **RNF-04** **Sin backend en v1 (confirmado §3.12):** todo cliente + caché navegador/CDN estático + localStorage. BFF con caché compartida = fase posterior solo si el fair use lo exige; no se construye en v1.
- **RNF-05** Tests: parser JSON-stat con fixtures reales grabadas (incl. demo_r_d3dens disperso), motor pivot con casos de totales/status/vacíos, **motor de derivados con casos de media/mediana/CAGR/índice 100 verificados a mano**, y recorrido E2E del flujo home→dataset→pivot→comparar países→media→gráfico→guardar→compartir→exportar Excel.
- **RNF-06** Accesibilidad básica: tabla siempre disponible como alternativa textual a todo gráfico/mapa; contraste y foco visibles en selectores.

## 3.10 Fuera de alcance v1
Cuentas de usuario / backend / base de datos; edición colaborativa; alertas por email/webhook (no existen en Eurostat); datos Comext `DS-` sin filtrar; descarga bulk completa como modo principal; vintages/histórico de revisiones (la API solo sirve última versión); medias ponderadas propias por población/PIB (v1 solo ofrece agregado oficial Eurostat o media simple rotulada, RF-28); resúmenes con LLM (RF-29 es por plantillas deterministas).

## 3.11 Criterios de finalización (definición de Jon: terminado = en producción)
Cada fase se cierra con: tests verdes, build verde, verificación en vivo contra la API real (no solo fixtures) y, al final del proyecto, despliegue en Vercel hecho por Jon + smoke test en la URL pública.

## 3.12 Decisiones de Jon — CERRADAS el 2026-11-05
| # | Decisión | Valor | Impacto directo en la spec |
|---|---|---|---|
| 1 | Marca | **EUROPIVOT** | Nombre del producto en toda la UI; «datos de Eurostat» como descriptor, nunca «Eurostat» como marca propia |
| 2 | Paneles multi-dataset | **Sí, en v1** | RF-17/RF-19/RF-20: cada panel con su propio PivotSpec; dashboard = colección de paneles independientes |
| 3 | Backend | **Sin backend en v1** | RNF-04: cliente + localStorage + URL compartible; sin cuentas ni BD |
| 4 | Idioma | **Todo ES por defecto** | RNF-01 + §2.1: capa de diccionario ES obligatoria; excepción expresa a la regla general EN de Jon |
| 5 | Mapas | **En v1** | RF-16 y T10 son obligatorios en v1, no opcionales |
| 6 | Export | **Excel además de CSV/PNG** | RF-21: .xlsx con hojas «Datos» y «Pivot» |
| 7 | Prioridad de producto | **Utilidad e interpretabilidad primero: comparar países fácil y sacar la media fácil** | C0 + §3.6 entero (RF-25 a RF-31), por encima de amplitud de catálogo |

## 3.13 Ficha mínima obligatoria por dataset curado (v2 — antes de traducir o diseñar tarjetas)
Ningún dataset entra en el pack, se traduce o recibe tarjeta en la home sin esta ficha **verificada contra metadatos oficiales (ESMS/TOC/DSD)**, guardada como datos de configuración versionados (no en código, C2):

| Campo | Contenido exigido |
|---|---|
| Código y título ES | Código online + título traducido |
| **Estado** | `activo` o `histórico/discontinuado`, con fuente oficial que lo acredite |
| **Sucesor** | Código sucesor cuando proceda (p. ej. `prc_hicp_midx` → `prc_hicp_minr`); si hay sucesor vigente, el pack usa el sucesor |
| Último periodo disponible | Leído de la API/metadatos en la fecha de la ficha (no de memoria) |
| Indicador y unidad por defecto | La selección inicial segura de RF-06, justificada en una línea |
| Dimensiones y roles | Lista con rol (time/geo/metric) según DSD/content constraint |
| **`validOps` (C13)** | Operaciones válidas por unidad/dimensión: sumable sí/no, media sí/no, Δpp vs Δ%, índice base 100 sí/no, ranking sí/no — con la frase explicativa que verá el usuario cuando algo esté desactivado |
| Naturaleza del agregado | Si el agregado oficial es media ponderada, suma, índice u otra cosa, según metodología ESMS (alimenta RF-28) |
| Consulta de ejemplo | URL real y acotada que devuelve datos, probada en la fecha de la ficha |
| Fecha y verificador | Fecha de verificación; la ficha caduca si el dataset cambia de estructura (RF-05) |

**Orden obligatorio:** primero se revisan las **tres entradas de precios** (familia IPCA, §2.7), después el resto del pack de 20, y **solo entonces** empieza la traducción de categorías (T14). Traducir un dataset que luego se sustituye es trabajo tirado.

---

# 4. PLAN TÉCNICO

## 4.1 Stack (propuesto, alineado con proyectos de Jon)
Vite + React + TypeScript, Tailwind, Zustand (estado pivot/dashboard), TanStack Query (caché de queries por URL canónica, 1 en vuelo), jsonstat-toolkit + jsonstat-euro, Recharts (líneas/barras), eurostat-map + Nuts2json (mapas, **en v1**), dnd-kit (drag & drop de dimensiones y paneles), **ExcelJS o SheetJS (export .xlsx en cliente, carga diferida solo al exportar)**, Vitest + Playwright. Sin backend v1. PWA con vite-plugin-pwa. `@vercel/analytics`.

## 4.2 Arquitectura (capas)
```
UI (Home / Dashboard multi-panel / Builder por panel)
  └─ Pivot Engine (puro, testeable): TidyTable + PivotSpec → PivotTable / Series / MapData / KPI
  └─ Derived Metrics Engine (puro, C0): TidyTable → media/mediana/min/max/Δ%/Δpp/CAGR/ranking/índice-100 + frase-resumen (plantillas ES)
       └─ Eurostat Client: buildQuery(spec) · presupuesto de celdas · fetch serializado · errores tipados (100/140/150/413/500)
            ├─ Statistics API (datos)
            ├─ Schema Service: content constraint/DSD (SDMX) o descubrimiento vía Statistics acotada → DatasetSchema versionado
            └─ Catalogue Service: TOC/metabase cacheados → búsqueda y árbol de temas
  └─ Geo Service: Nuts2json/GISCO por (añoNUTS, nivel, escala) cacheado permanente
  └─ ES Dictionary Service: JSON versionado (cáscara, temas, geo, codelists del pack) EN→ES, con registro de huecos
  └─ Freshness Service: probe updated (lastTimePeriod=1), agenda 11:00/23:00 Brussels, badge + refresco RF-22/24
  └─ Store: Zustand + persist localStorage + codec URL (share)
       Dashboard = { id, nombre, panels: Panel[] }  ·  Panel = { id, PivotSpec propio, viz, título, rect en rejilla }
```

**Modelo de datos clave:**
```ts
type PivotSpec = {
  dataset: string; lang: 'EN'|'FR'|'DE';
  filters: Record<DimId, Code[]>;          // lo que SÍ dispara re-extracción
  time: { mode:'last', n:number } | { mode:'range', since:string, until:string } | { mode:'values', values:string[] };
  geoLevel?: 'aggregate'|'country'|'nuts1'|'nuts2'|'nuts3'|'city';
  rows: DimId[]; columns: DimId[];          // layout: repivotar NO re-extrae
};
type TidyRow = { [dim:string]: string; value: number|null; status?: string };
type DatasetSchema = { dataset:string; version:string; dims: { id:string; label:string; role?:'time'|'geo'|'metric'; categories:{code:string;label:string}[] }[] };
```

## 4.3 Flujos críticos
1. **Seleccionar dataset:** Catalogue (cache) → Schema Service → RF-06 selección segura → presupuesto → extracción → tidy → pivot por defecto (time en columnas, geo en filas si existe).
2. **Repivotar:** drag dimensión → Pivot Engine sobre tidy en memoria → re-render paneles. Cero red.
3. **Cambiar filtro:** debounce 300ms → presupuesto → si ok, 1 extracción → tidy nuevo → re-render + actualizar `updated` mostrado.
4. **Mapa:** si geo presente → Geo Service (año NUTS del schema, escala 20M) → join literal → agregados a lista lateral.
5. **Refresco:** timer/probe → `updated` cambió → aviso → aplicar cuando no haya interacción activa.

## 4.4 Rendimiento y fair use
Caché TanStack Query por URL canónica (staleTime alineado al ciclo Brussels), serialización por dataset, abort de extracciones superadas, virtualización de tabla pivot >500 filas visibles, Web Worker para aplanado JSON-stat si Πsize >50.000 (evaluar en Fase 1 con fixture real).

## 4.5 Prueba temprana de la arquitectura sin backend (v2 — antes del constructor completo)
La decisión «sin backend» (RNF-04) tiene una dependencia no demostrada: el navegador debe obtener **catálogo y esquema completo** de cada dataset para poblar selectores y presupuestar. Una respuesta acotada de Statistics solo demuestra qué categorías vinieron *en esa consulta*, no que el selector conozca todas las disponibles. Por eso, **antes de construir el constructor pivot**, se ejecuta la tarea **T00 (spike en navegador real)** con este recorrido completo y grabado: buscar un dataset → cargar sus dimensiones y **todas** sus categorías → elegir España y Francia → estimar el tamaño → obtener los datos. Se prueba la ruta de esquema por las dos vías (Statistics acotada y SDMX content constraint desde navegador).
**Ruta de reserva, compatible con «sin backend»:** si catálogo o metadatos dan problemas de acceso desde el navegador, se generará un **índice estático versionado en tiempo de compilación** (script de build que descarga TOC/metabase/DSD/constraints y emite JSON versionado junto a la app; se regenera en cada despliegue). La decisión entre vía directa e índice estático se toma **con el resultado de T00, antes de T04/T05**, y queda escrita en este SDD.
**DECISIÓN T00 (2026-11-05, spike en navegador real — informe completo en `docs/T00-resultados.md`, crudo en `spike/t00-report.json`): arquitectura HÍBRIDA sin backend.** (1) Datos: Statistics API directa (recorrido ES+FR verificado: estimación 20 celdas = 20 valores). (2) Esquema: **SDMX 2.1 directo desde el navegador** — el content constraint responde 200 con CORS `*` en 5,6 KB con todas las categorías (la sonda equivalente por Statistics costó 582 KB y no garantiza completitud); SDMX 3.0 descartada (404 en servidor para content constraints). (3) Catálogo: **índice estático de build** — la Catalogue API (TOC TXT y XML) no envía cabecera CORS y el navegador la bloquea; se aplica la ruta de reserva SOLO al catálogo. T04 = generador del índice + consumo; T05 = Schema Service contra SDMX 2.1.

## 4.6 Hito demostrable M1 — la promesa, antes que el catálogo (v2)
Antes de ampliar catálogo, mapas o multi-dataset, debe funcionar de principio a fin este recorrido, que Jon pueda juzgar en persona:
> Desde la portada, **comparar el PIB per cápita de España, Francia y Alemania en una unidad común, con 10 años de datos y la referencia oficial de la UE** → pasar de **tabla a gráfico sin otra petición** a Eurostat → **abrir el enlace compartido en un navegador limpio** y recuperar **los mismos países, la misma unidad, los mismos periodos y la misma referencia UE** (codec de un panel adelantado a T09b, RF-20 v2.1) → la pantalla **explica qué significa la diferencia** que se ve (frase RF-29 con etiqueta RF-28).
M1 comprueba a la vez: arquitectura sin backend, motor pivot, derivados con reglas (C13), compartir vivo (RF-20) e interpretabilidad (C0). Si M1 no se entiende en 10 segundos, no se sigue ampliando: se corrige M1.

---

# 5. TAREAS PARA Muse (una tarea por ejecución, en orden)

> Regla de ejecución (patrón Jon): una tarea por sesión de Muse, con su RF, tests primero (rojo→verde), commit con identidad GitHub de Jon, sin push a Vercel ni despliegue. Cada tarea termina con evidencia: salida de tests + build.

| ID | Tarea | RF | Entregable / aceptación |
|---|---|---|---|
| **T00** | **Spike arquitectura sin backend en NAVEGADOR REAL (v2, va primero tras T01/T02/T03 mínimos): recorrido buscar dataset → dimensiones y categorías completas → ES+FR → presupuesto → datos; probar esquema vía Statistics y vía SDMX desde navegador** | §4.5, RNF-04 | **Grabación/informe del recorrido real; decisión escrita: vía directa o índice estático de build. Sin esta puerta no se sigue a T04/T05** |
| T01 | Scaffold Vite+React+TS+Tailwind+PWA+Analytics, estructura de capas §4.2, CI lint/test/build | RNF-02/03 | Build verde; PWA manifest válido |
| T02 | Eurostat Client: buildQuery + tipos de error + serialización por dataset | RF-08/10/11, C6 | Tests unitarios de URL (geoLevel excluyente, modos temporales) verdes |
| T03 | Parser JSON-stat→tidy con jsonstat-toolkit + fixtures reales (demo_r_d3dens, nama_10_gdp filtrado) | RF-04, C3 | Fixtures aplanadas == conteos OBS_COUNT; status conservado |
| T04 | Catalogue Service: TOC+metabase cacheados, búsqueda, árbol 9 temas | RF-01/03 | Búsqueda por código y título <100ms sobre caché |
| T05 | Schema Service + selección segura inicial + presupuesto de celdas | RF-04/05/06/09 | Presupuesto bloquea caso >200k con explicación por dimensión |
| **T05b** | **Revisión del pack: fichas mínimas §3.13 de los 20 datasets (precios primero: sustituir familia IPCA v1 por sucesoras v2) con `validOps` y naturaleza del agregado por dataset** | C13/C14, §3.13, RF-27/28/32 | 20 fichas verificadas contra ESMS/DSD con fecha; precios en v2 (`prc_hicp_minr`/`prc_hicp_ainr`); ninguna traducción (T14) empieza antes que esta tarea |
| T06 | Pivot Engine puro (filas/columnas/totales, series, KPI, ranking) | RF-07/15, C4 | Tests: repivotar no llama a red (spy); totales correctos |
| T06b | **Derived Metrics Engine (C0)**: media/mediana/min/max/Δ%/Δpp/CAGR/índice-100 + referencia UE + frase-resumen ES por plantillas, **gobernado por `validOps` de la ficha (T05b): operación no declarada = no se ofrece** | RF-26/27/28/29/30/32/33, C13 | Casos calculados a mano coinciden; casos RF-32 verdes (suma de tasas desactivada, pp vs %, periodo común, base cero/ausente); media simple rotulada ≠ agregado oficial (test de etiqueta) |
| T07 | Home dashboard: tarjetas de temas + destacados con fecha `updated` **desde metadatos primero** (probe de datos solo pequeño y presupuestado) | RF-01/02 (v2) | Home usable con probes fallando (fail-soft); abrir la home no dispara extracciones sin presupuesto (verificado contando peticiones) |
| T08 | Builder UI: zonas Filas/Columnas/Filtros (dnd-kit) + selectores RF-12/13/14 + **selector rápido de países y presets RF-25** | RF-07/08/12/13/14/25 | Recorrido E2E: comparar ES/FR/DE en ≤3 interacciones; arrastrar no re-extrae |
| T09 | Paneles: tabla pivot virtualizada + líneas + barras + ranking + KPI, con contexto RF-31 y frase RF-29 visibles | RF-15/29/31 | Mismo PivotSpec rinde 5 vistas coherentes, todas con unidad/periodo/updated |
| **T09b = M1** | **Hito demostrable §4.6: comparación PIB per cápita ES/FR/DE, unidad común, 10 años, referencia oficial UE; tabla→gráfico con 0 peticiones; frase explicativa en pantalla; INCLUYE el codec de URL de un solo panel (adelantado de T11, RF-20 v2.1)** | §4.6, C0/C13, RF-20/25/26/29 | **Jon lo juzga en persona antes de seguir a T10/T11/ampliar catálogo. Pruebas: tabla→gráfico = 0 peticiones (contador de red); enlace abierto en navegador limpio recupera mismos países, unidad, periodos y referencia UE** |
| T10 | Mapa coroplético eurostat-map/Nuts2json + lista de agregados — **obligatorio v1** | RF-16 | Join literal verificado con nama_10r_2gdp NUTS2 |
| T11 | Dashboards **multi-dataset**: rejilla de paneles independientes, persistencia localStorage, y **ampliación del codec de URL de T09b a la colección completa de paneles** (mismo formato versionado; los enlaces de un panel de M1 siguen abriendo) | RF-17/18/19/20 | Dashboard con paneles de 2 datasets distintos se guarda, comparte por URL y se reproduce en navegador limpio; enlace M1 de un panel sigue válido (test de compatibilidad) |
| T12 | Export **CSV/TSV + Excel (.xlsx, hojas Datos/Pivot) + PNG** con cita Eurostat | RF-21, C12 | Excel abre con ambas hojas, derivados rotulados y cita presente |
| T13 | Freshness Service: probe updated, agenda Brussels, aviso sin interrumpir | RF-22/23/24, C10 | Test con updated simulado: avisa y no aplica durante drag |
| T14 | **Todo ES**: ES Dictionary Service + diccionario completo del pack curado (geo/temas/dimensiones/codelists) + cáscara EN alternativa + accesibilidad | RNF-01/06, §2.1 | Pack curado al 100% en ES sin huecos; dataset fuera del pack degrada a EN con registro de hueco, sin romperse |
| T15 | Hardening: E2E completo Playwright, fixtures 413/100, **los dos estados de RF-10 probados por separado (en preparación asíncrono vs demasiado grande)**, **casos RF-32 (suma de tasas desactivada, +1pp vs +20%, ranking con periodo común, índice base cero/ausente)** y **RF-08 contando peticiones (ocultar = 0, ampliar = 1)**, smoke en vivo API real, README Muse | RNF-05, §3.11, RF-08/10/32 | Suite verde + informe de verificación en vivo |
| T16 | (Solo a orden de Jon) Push GitHub + entrega para despliegue Vercel por Jon | §3.11 | Jon despliega; smoke en URL pública |

**Orden y dependencias (v2):** T01→T02→T03→**T00 (puerta de arquitectura)**→(T04,T05)→**T05b (fichas del pack, precios primero)**→T06→T06b→T07→T08→T09→**T09b/M1 (puerta: Jon juzga la comparación)**→T10→T11→T12→T13→T14→T15→T16. Mapas (T10) y multi-dataset (T11) son v1 por decisión de Jon, no opcionales — pero van **después** de M1. T14 (traducción) nunca antes que T05b.
**Estimación orientativa:** T02/T03/T06/T08 son el corazón (sesiones largas); resto sesiones medias. Sin fechas cerradas: cada tarea se valida antes de pasar a la siguiente.

---

# 6. PROMPT DE ARRANQUE PARA Muse (pegar en el repo)

```
Lee SDD-MASTER.md completo antes de tocar código. Es la fuente de verdad.
Trabaja SOLO la tarea indicada (Txx) en esta sesión. Sigue la Constitución (§1):
en especial C2 (sin literales de dataset en el motor), C3 (tidy primero),
C4 (repivotar no re-extrae), C5 (presupuesto antes de consultar) y C9.
Tests primero, rojo→verde. No despliegues, no toques Vercel, no hagas push
sin orden expresa. Commit con autor Jon Peciña <jpecinagithub@users.noreply.github.com>.
Al terminar, entrega: diff resumido, salida de tests y build, y qué RF valida.
Si la spec es ambigua, marca [NECESITA ACLARACIÓN] y pregunta: no inventes.
```

---

# 7. RESUMEN DE LA REVISIÓN v2 (revisión de Jon, 2026-11-05 — proyecto APROBADO, decisiones de producto intactas)
**Riesgo principal identificado:** una comparación convincente pero estadísticamente incorrecta — la tabla carga, el gráfico se dibuja y la exportación funciona aunque se sumen porcentajes o se comparen países de años distintos. Los 5 cambios, en su orden:
1. **Reglas de cálculo** → C13 + RF-27/RF-28 corregidos + RF-32/RF-33 + `validOps` en la ficha: operaciones válidas por indicador/unidad/dimensión en configuración; etiqueta general «agregado oficial de la UE».
2. **Pack revisado antes de traducir** → C14 + §3.13 + T05b: ficha mínima por dataset; precios corregidos (IPCA ECOICOP v1 `prc_hicp_midx/aind/manr` → familia v2 `prc_hicp_minr/ainr`, ECOICOP 2 y base 2025=100 desde feb-2026, verificado contra ESMS oficiales Eurostat).
3. **Arquitectura probada pronto** → §4.5 + puerta T00 en navegador real; reserva: índice estático versionado generado en build, compatible con «sin backend».
4. **Contrato de consultas/refresco** → RF-08 (ocultar = 0 peticiones, ampliar = extracción), RF-01/RF-22 (metadatos primero, probes pequeños presupuestados), RF-10 (dos estados: en preparación 500k–5M vs demasiado grande >5M; límite propio 200k intacto).
5. **Comparación completa adelantada** → §4.6 + puerta M1/T09b (PIB per cápita ES/FR/DE, 10 años, referencia UE, tabla→gráfico sin petición, enlace en otro navegador, diferencia explicada) + RF-20/RF-21 (enlace = configuración viva con cifras posiblemente revisadas; Excel = foto fija citable).
**Si solo cupieran dos: ① reglas de cálculo (protege la confianza) y ③ prueba en navegador (comprueba a bajo coste que la arquitectura sostiene el producto).**

---
*Fuentes del análisis: documentación oficial Eurostat (Getting started, API Statistics, Asynchronous API, Catalogue API, SDMX 2.1/3.0, GISCO/NUTS, copyright notice) consultada 2026-11-05 + verificación en vivo de Statistics API (DEMO_R_D3DENS). Informe completo de investigación disponible en el workspace. Verificación v2: ESMS oficiales Eurostat de cultura/deporte (familias IPCA ECOICOP v1 `prc_hicp_midx/aind` vs v2 `prc_hicp_minr/ainr`) y guía oficial Asynchronous API (413/EXTRACTION_TOO_BIG, polling de estado), consultados 2026-11-05.*
