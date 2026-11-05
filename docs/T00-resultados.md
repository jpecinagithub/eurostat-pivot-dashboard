# T00 — Resultados del spike de arquitectura sin backend (puerta §4.5)

**Fecha:** 2026-11-05 · **Entorno:** Chrome real, página `spike/t00.html` servida en
origen público (el localhost de la VM no es alcanzable desde el navegador de
pruebas; el CORS de Eurostat no depende del origen concreto: o es `*` o no hay
cabecera). Informe crudo: `spike/t00-report.json`. Dataset del recorrido:
`nama_10_gdp`.

## El recorrido, paso a paso

| Paso | Resultado | Evidencia |
|---|---|---|
| 1 · Descubrir en el catálogo (TOC TXT desde el navegador) | ❌ **Bloqueado por CORS** | `fetch` rechazado (`Failed to fetch`). Por curl el TOC responde 200 pero **sin `Access-Control-Allow-Origin`** — igual en TXT y en XML: toda la Catalogue API es ilegible desde un navegador |
| 2 · Esquema completo vía **SDMX 2.1** content constraint | ✅ **Funciona** | 200 en 850 ms, **5,6 KB**. Categorías de `nama_10_gdp`: freq 1 · unit 32 · na_item 39 · geo 46 · TIME_PERIOD 51 (1975–2025). Cabecera `Access-Control-Allow-Origin: *` |
| 3 · Esquema acotado vía Statistics (`geoLevel=country&lastTimePeriod=1`) | ⚠️ Funciona pero es la vía cara | 200 en 1.664 ms, **582 KB**, 28.952 valores descargados solo para aprender categorías. Coincide en unit (32) y na_item (39) *en este dataset y año*, pero geo trae 40 de 46 y time 1 por construcción: una respuesta acotada solo garantiza lo que vino, no todo lo disponible (la cautela del SDD) |
| 4 · Recorrido completo: elegir ES+FR → estimar → datos | ✅ **Funciona** | Estimación 20 celdas = **20 valores recibidos**, periodos 2016–2025, 1.114 ms, 3,5 KB, `updated 2026-10-22` |
| 5 · Esquema vía SDMX 3.0 content constraint | ❌ **No viable** | Por curl: **404** (Eurostat no sirve ese artefacto en esa ruta, ni con `~` ni con `1.0`); en navegador, fetch rechazado |

## Decisión (con esta evidencia, antes de T04/T05)

**Arquitectura híbrida, sin backend, cada capa por la vía que demostró funcionar:**

1. **Datos → Statistics API directa** (T02/T03 ya lo cubren). CORS oficial,
   recorrido completo verificado de punta a punta.
2. **Esquema → SDMX 2.1 directo desde el navegador** (content constraint para
   las categorías disponibles + datastructure para orden/etiquetas). 5,6 KB
   frente a 582 KB de la sonda por Statistics, y es la fuente autoritativa
   de «qué se puede pedir» (C9). SDMX 3.0 queda descartada para esquema.
3. **Catálogo/descubrimiento → índice estático versionado generado en build**
   (la ruta de reserva del §4.5, aplicada SOLO donde la evidencia la exige):
   la Catalogue API no envía CORS, así que el TOC se descarga en tiempo de
   compilación y se sirve con la app. De regalo: búsqueda instantánea, temas
   y títulos bajo nuestro control para la capa ES. Se regenera en cada
   despliegue; su frescura se declara (fecha del índice visible en la app).

Consecuencia para las tareas: **T04** construye el generador del índice
estático (TOC → JSON versionado) + su consumo; **T05** implementa el Schema
Service contra SDMX 2.1. Ninguna de las dos necesita backend ni proxy.
