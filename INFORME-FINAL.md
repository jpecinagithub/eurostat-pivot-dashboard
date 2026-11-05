# EUROPIVOT — Informe final

**Fecha:** 5 de noviembre de 2026 · **Producto en vivo:** https://eurostat-pivot-dashboard.vercel.app/
**Repo:** https://github.com/jpecinagithub/eurostat-pivot-dashboard · **Spec:** `SDD-MASTER.md` (fuente de verdad)

## 1. Qué se pidió

Un dashboard tipo tabla dinámica sobre los datos abiertos de Eurostat: elegir
dataset, configurar dimensiones en filas/columnas/filtros, comparar países con
facilidad, compartir resultados y exportarlos — sin backend y en español.
Decisiones de producto (Jon, 2026-11-05): marca EUROPIVOT; paneles de datasets
distintos en un mismo dashboard desde v1; v1 sin backend; todo en español por
defecto; mapas en v1; export Excel además de CSV/PNG. Prioridad nº 1 (C0):
que la información sea útil y fácil de interpretar, fácil comparar países y
fácil sacar la media — sin que una comparación convincente sea
estadísticamente incorrecta (ese fue el riesgo nº 1 señalado en la revisión
v2 del SDD, y gobernó el diseño: reglas de cálculo por dataset `validOps`,
agregado oficial de la UE siempre distinguido de la media simple calculada).

## 2. Qué se construyó (T00–T16, todas hechas)

| Fase | Resultado |
|---|---|
| T00 (puerta) | Arquitectura sin backend demostrada en navegador real: datos por Statistics API, esquema por SDMX 2.1 (la Catalogue API no da CORS → índice estático de build), decisión híbrida registrada |
| T01–T03 | Andamiaje (Vite+React+TS, PWA, i18n ES/EN), cliente Eurostat tipado (errores 100/140/150/413 distinguidos), parser JSON-stat 2.0 (ausencia ≠ 0, marcas como columna) |
| T04–T05 | Índice del catálogo en build: 10.408 entradas (8.887 datasets visualizables); servicio de esquema SDMX con presupuesto de celdas previo (límite interactivo 200.000) |
| T05b + Top100 | **33 fichas de dataset verificadas una a una** contra la API viva (protocolo C14): las 19 iniciales + 14 de los temas más leídos de Statistics Explained a petición de Jon. Trampas reales cazadas: la tasa anual del IPCA vive en otro dataset; en `ilc_li02` la serie viva es B_60, no A_60; el último periodo del constraint de precios industriales no tiene datos |
| T06/T06b | Motor pivot puro (repivotar no re-descarga) y motor de derivados gobernado por `validOps`: media simple siempre rotulada, +1 pp ≠ +20 %, ranking con periodo común y excluidos a la vista, índice base 100 que no se calcula sin base válida |
| T07–T09 | Portada con buscador sobre el catálogo y las 33 tarjetas; constructor con el esquema real de cualquier dataset, presets de países en 1 clic (UE-27, zona euro, España y vecinos) y estimación previa que bloquea consultas imposibles; panel con tabla, gráfico con ejes, frase-resumen determinista y contexto obligatorio (unidad, periodo, `updated`, fuente) |
| T09b/M1 | Enlaces de un panel (`?p=v1.`) que llevan la configuración, no las cifras. M1 verificado en vivo: PIB per cápita PPA 2025 — España 38.161,7 · Francia 40.716,0 · Alemania 48.621,8 · UE oficial 41.773,5; media simple 42.499,8 ≠ agregado oficial |
| T10 | Mapa coroplético NUTS (GISCO directo, SVG propio): join literal verificado 293/309; las pseudorregiones sin geometría se listan aparte con su valor |
| T11 | Dashboards multipanel: rejilla responsive, paneles independientes multi-dataset, persistencia automática en el navegador y enlaces completos (`?d=v1.`) compatibles con los de M1 |
| T12 | Export foto fija citable: Excel con hojas «Datos» y «Pivot» (derivados rotulados, marcas con su texto oficial), CSV/TSV y PNG; cada fichero lleva dentro cita, fecha de exportación y `updated` del dataset |
| T13 | Freshness Service: comprobación alineada al ciclo de Eurostat (11:00/23:00 Bruselas, agenda con DST verificado), probe mínimo, aviso sin aplicar jamás el refresco solo |
| T14 | ES Dictionary Service: cadena español propio → nombre oficial EN → código, con registro de huecos; cobertura verificada por test del 100 % de valores por defecto y títulos de dimensión de las 33 fichas |
| T15 | Endurecimiento: E2E en Chromium real 13/13 (arranque M1, constructor, RF-08 contado: transponer = 0 peticiones, ampliar = +1; RF-10 separado: demasiado grande vs en preparación vs sin datos); smoke de API en vivo PASS |
| T16 | Despliegue por Jon en Vercel y smoke sobre la URL pública (ver §4) |

Extras a petición de Jon durante la jornada: estilo visual del Atlas de
proyectos aplicado a toda la app; desplegables nativos corregidos para el
tema oscuro.

## 3. Defectos reales encontrados probando en vivo (y corregidos)

1. **Etiquetas del constructor ininteligibles** (veredicto de Jon sobre M1):
   códigos crudos que se solapaban → nombres descriptivos por capas
   (diccionario ES + codelists oficiales) y rejilla sin solapes.
2. **«No me selecciona por países»** (`isoc_eb_ai`): la selección inicial
   dejaba el tamaño de empresa en 0–1 empleados, un corte casi vacío
   (3 valores frente a 20/20 con 10+ empleados, verificado contra la API)
   → valores por defecto por dimensión en las fichas, y el panel ahora
   nombra los países seleccionados sin datos.
3. **Pantallazo negro al generar** algunos constructores: varios valores en
   una dimensión no colocada lanzaban un error al pintar que tumbaba toda
   la app (también al abrir el enlace). Reproducido en test antes de
   tocar código; corregido en tres capas (el constructor avisa y bloquea,
   el panel captura y explica, test de regresión permanente).

## 4. Verificación final (2026-11-05)

- **Unitarios/integración:** 136/136 (Vitest + jsdom, 24 ficheros).
- **E2E navegador real:** 13/13 (Playwright/Chromium contra la build).
- **Smoke API en vivo:** consulta M1 real → HTTP 200, `updated` 2026-10-22,
  España 2025 = 38.161,7 (sin revisiones desde la verificación inicial).
- **URL pública:** raíz 200 con el título correcto; el bundle servido
  contiene el código actual (fijar en dashboard, export Excel, frescura
  11:00/23:00, nota de países sin datos, «Producto interior bruto (PIB)»,
  media simple rotulada); manifest y service worker 200 (PWA instalable);
  chunk del catálogo 200; las rutas con `?p=`/`?d=` sirven el documento.
- **Limitación de entorno declarada:** desde la VM del agente no se pudo
  ejecutar el smoke de navegador contra la URL pública (su proxy de salida
  rechaza tanto ec.europa.eu como las URLs muy largas); el recorrido en
  vivo lo ha ejercido Jon en su navegador durante toda la jornada — de ahí
  salieron los tres defectos del §3, ya corregidos y redesplegados.

## 5. Alcance honesto y cabos sueltos

- Los **8.887 datasets** del catálogo se pueden abrir y visualizar con el
  motor genérico; la garantía verificada (defaults vivos, reglas de
  cálculo, etiquetas ES) cubre las **33 fichas**. Propuesta no aprobada:
  barrido automático T05c para generar fichas «automáticas, sin verificar»
  del resto.
- Las codelists muy largas (121 conceptos de cuentas nacionales, toda la
  NACE) muestran su nombre oficial en inglés y quedan registradas como
  huecos del diccionario; traducirlas es trabajo incremental seguro.
- «EU trade with China» no se implementó: su artículo se alimenta de
  Comext, que no ofrece la vía de esquema que el constructor necesita.
- Vercel Analytics está integrado por código; la activación en el panel
  de Vercel es de Jon (regla general de sus proyectos).
- Sin backend: los datos viven en Eurostat; lo del usuario (dashboard)
  vive en su navegador (localStorage) y en los enlaces que comparta.

## 6. Cómo se usa (30 segundos)

Abrir la web → elegir una tarjeta del pack o buscar cualquier dataset →
en el constructor, usar un preset de países (1 clic) o marcar valores →
«Usar esta configuración» → tabla, gráfico y mapa al momento → «Fijar en
el dashboard» para componer varios paneles → «Compartir» para el enlace
vivo o «Exportar» para la foto fija citable en Excel/CSV/PNG.

*Proyecto de Jon Peciña — jpecina@gmail.com. Datos: © Eurostat; geometrías: © EuroGeographics / GISCO.*

## 7. Ronda QA post-entrega (2026-11-05, tarde)

Jon auditó la producción desde el navegador (Chromium/Windows, perfiles
aislados, fallos de red y almacenamiento inducidos; informe y scripts en
su poder) y reprodujo **tres fallos prioritarios y siete puntos muertos**
que las 13 pruebas E2E existentes — que pasaban — no cubrían. Todos
corregidos el mismo día, cada uno con su regresión:

**Prioritarios**
1. **Abrir un dashboard compartido sobrescribía el propio.** Ahora el
   enlace entra en *solo consulta*: no se persiste ni al mostrarlo, ni
   al editarlo en pantalla, ni al descartarlo; la cabecera lo dice y
   solo el botón expreso «Guardar una copia en mi navegador» lo
   convierte en propio. Regresión extremo a extremo: el guardado
   «Mi trabajo original» sobrevive a abrir «Proyecto ajeno».
2. **Página en blanco con localStorage denegado.** Referenciar el
   objeto de almacenamiento lanzaba la excepción *antes* del
   try/catch, al crear el store. Ahora todo acceso a localStorage se
   resuelve dentro de try/catch y la app arranca y funciona en
   memoria sin almacenamiento.
3. **Página en blanco por una fecha de guardado ilegible**
   («Invalid time value» al formatear). La fecha se valida al leer
   lo persistido (una ilegible se descarta y el dashboard se recupera
   sin fecha), el formateo es defensivo y cada sección principal
   (constructor, panel, dashboard) queda aislada por una frontera de
   error: un fallo de pintado ya no tumba la página entera.

**Secundarios**
- Descargas con salida visible: el esquema del constructor ofrece
  «Reintentar» para el mismo dataset; la descarga de datos tiene
  límite de 30 s, «Cancelar» durante la carga y «Reintentar» tras el
  error (los filtros se conservan).
- Móvil: elegir un dataset (tarjeta o búsqueda) lleva el scroll y el
  foco al encabezado del constructor.
- El enlace de dashboard conserva título, visualización y ancho de
  cada panel; los enlaces antiguos (sin metadatos) siguen abriendo.
- El botón PNG solo está activo cuando hay un gráfico o mapa
  exportable en pantalla; con cero observaciones, todas las
  exportaciones se desactivan.
- Dos fichas empezaban vacías por el primer valor genérico de una
  dimensión (mismo patrón que el defecto de `isoc_eb_ai`): deuda
  pública queda fijada al sector S13 y costes laborales al agregado
  NACE B-S_X_O — ambos verificados contra la API viva (3 valores en
  la ventana de prueba frente a 0 con el valor genérico).
- Offline: el service worker cachea las respuestas de la API
  (NetworkFirst: con red manda lo fresco; sin red, la última copia
  consultada, que el panel fecha con su `updated` oficial).

**Evidencia de la ronda:** 142/142 tests unitarios e integración
(6 regresiones nuevas), E2E 13/13, lint y build en verde, smoke de
API en vivo PASS. Nota de harness: el E2E bloquea ahora el service
worker a nivel de contexto (`serviceWorkers: 'block'`) porque los
fetches internos de un SW no pasan por la interceptación de
Playwright en esta versión — el SW se verifica por el contenido de
`dist/sw.js`, que contiene las tres cachés runtime nuevas.

**Estado:** correcciones en el repo (rama `main`); la producción
seguirá sirviendo la build anterior hasta que Jon redespliegue.
