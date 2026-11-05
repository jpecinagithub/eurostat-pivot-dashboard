# EUROPIVOT — Reporte para Codex

**Fecha:** 2026-11-05 · **Autor del reporte:** Muse (agente de Jon Peciña)
**Propósito:** traspaso completo del proyecto: qué es, en qué estado queda,
qué invariantes no deben romperse y qué queda abierto. La fuente de verdad
detallada es `SDD-MASTER.md` (spec) e `INFORME-FINAL.md` (cierre) en el repo.

## 1. El producto

**EUROPIVOT** — dashboard tipo tabla dinámica sobre los datos abiertos de
Eurostat, sin backend, en español por defecto. El usuario elige un dataset,
configura dimensiones (filas/columnas/filtros), compara países con presets
de 1 clic, compone dashboards multipanel, comparte por enlace y exporta
(Excel/CSV/TSV/PNG) con cita.

- **Producción:** https://eurostat-pivot-dashboard.vercel.app/
- **Repo (público):** https://github.com/jpecinagithub/eurostat-pivot-dashboard
- **Rama/commit en producción:** `main` @ `8a111b8` (verificado por el
  agente sobre la URL pública el 2026-11-05 19:31 CET: el bundle servido
  contiene todas las marcas de la última ronda; ver §5).
- **Stack:** Vite 8 + React 19 + TypeScript, Tailwind v4, zustand,
  @tanstack/react-query (infra), jsonstat-toolkit, exceljs (lazy),
  vite-plugin-pwa (Workbox), @vercel/analytics. Tests: Vitest + jsdom y
  E2E con playwright-core contra el Chromium del sistema.

## 2. Arquitectura (decisión T00, no reabrir sin evidencia nueva)

Sin backend. Tres vías de datos, todas verificadas en navegador real:

| Qué | Vía | Por qué |
|---|---|---|
| Datos | Statistics API directa (`/statistics/1.0/data/{code}`) | JSON-stat 2.0, CORS oficial |
| Esquema (dimensiones y códigos válidos) | SDMX 2.1 directa (datastructure + contentconstraint) | La Statistics API como sonda de esquema se descartó (pesada e incompleta); SDMX 3.0 no expone constraint (404) |
| Catálogo (10.408 entradas; 8.887 datasets) | Índice estático generado en build (`scripts/build-catalogue-index.mjs`, `prebuild --soft`) | La Catalogue API no envía cabeceras CORS |
| Geometrías de mapa | GISCO GeoJSON NUTS 2024 directo | CORS `*` |

Capas: `core/types` → `services` (eurostatClient, jsonstatParser,
schemaService, catalogueService, codelistService, dictionaryService,
freshnessService, geoService) → `engine` (pivotEngine, derivedMetrics,
puros) → `features` (modelos + codecs + persistencia) → `components`
(Home, Builder, Panel, Dashboard) → store zustand.

## 3. Estado: CERRADO y en producción

- Plan SDD **T01–T16 completo** (scaffold → cliente → parser → catálogo →
  esquema → pack curado → motor pivot → derivados → home → constructor →
  panel → hito M1 → mapa → dashboards → export → frescura → diccionario ES
  → endurecimiento E2E → entrega).
- **Pack curado: 33 datasets verificados uno a uno** contra la API viva
  (protocolo C14: constraint leído + consulta de ejemplo ejecutada desde
  el propio fichero de configuración). El motor genérico abre los 8.887
  del catálogo, pero la garantía verificada cubre esas 33 fichas.
- **Ronda QA post-entrega (2026-11-05 tarde) cerrada en producción:**
  Jon auditó la web en navegador y reprodujo 3 fallos prioritarios + 7
  secundarios que el E2E no cubría; todos corregidos con regresión
  (detalle en §4 e INFORME-FINAL.md §7).

## 4. Invariantes que NO deben romperse

1. **C0 (prioridad nº1):** utilidad e interpretabilidad. Comparar países
   en 1 clic; el **agregado oficial de la UE** siempre distinguido de la
   **media simple calculada** (rotulada literalmente «Media simple
   calculada por EUROPIVOT (sin ponderar) — no es el agregado oficial»).
2. **Reglas de cálculo en la ficha, no en el motor:** `validOps` por
   dataset/unidad en `src/config/curatedPack.ts` decide qué operaciones
   existen; el motor (`derivedMetrics`) es genérico. Casos RF-32 con
   test literal: sumar tasas de paro está prohibido; +1 pp ≠ +20 %;
   ranking con periodo común y excluidos nombrados; índice base 100
   sin base válida no se calcula.
3. **Ausencia ≠ 0:** celda sin observación = `null`, jamás 0. Las marcas
   (`status`) son columna propia con el texto oficial de Eurostat.
4. **Repivotar ≠ re-consultar (RF-08):** subconjuntos ya descargados =
   0 peticiones; ampliar = solo lo que falta. Presupuesto interactivo
   de 200.000 celdas calculado ANTES de consultar (C5).
5. **Enlaces = configuración, no datos (RF-20):** `?p=v1.` (un panel) y
   `?d=v1.` (dashboard) en base64url versionado. El codec de dashboard
   conserva título/viz/ancho por panel y **debe seguir abriendo los
   enlaces antiguos** (paneles pelados sin metadatos; hay test con el
   formato legado y con el enlace real de M1).
6. **Dashboard compartido = solo consulta (P1, QA):** un `?d=` entrante
   NUNCA se persiste automáticamente — ni al mostrarse, ni al editarse,
   ni al descartarse. La persistencia se gobierna por un contador
   (`persistSeq`) que solo sube con cambios del dashboard propio; solo
   «Guardar una copia» convierte el compartido en propio.
7. **localStorage jamás tumba la app (P2/P3, QA):** todo acceso al
   objeto de almacenamiento se resuelve dentro de try/catch
   (`safeLocalStorage`); sin almacenamiento, la app funciona en
   memoria. `savedAt` se valida al deserializar (ilegible → se
   descarta, el dashboard se recupera sin fecha) y las secciones
   principales están aisladas con fronteras de error (`SafeSection`).
8. **Toda descarga tiene salida visible (QA):** reintento en el
   constructor (mismo dataset) y en el panel; límite de 30 s con
   AbortController, «Cancelar» durante la carga; los abortos no se
   envuelven como error de red en `eurostatClient`.
9. **Defaults de ficha verificados en vivo (C14):** el primer valor de
   una dimensión en la constraint puede ser un corte vacío. Defaults
   actuales probados contra la API: `isoc_eb_ai` size_emp=GE10,
   `gov_10a_main` sector=S13, `gov_10dd_edpt1` sector=S13,
   `lfsi_emp_a` age=Y20-64, `lc_lci_lev` nace_r2=B-S_X_O. Trampas
   conocidas: en `ilc_li02` la serie viva es B_60 (no A_60); la tasa
   anual del IPCA vive en `prc_hicp_minr` como unidad RCH_A;
   `sts_inppd_m` tiene datos hasta 2026-09 aunque la constraint
   anuncie 2026-10.
10. **Frescura honesta (RF-22/24):** Eurostat actualiza 11:00/23:00
    (Bruselas); el aviso de datos nuevos nunca aplica el refresco solo.
    El SW cachea la API en runtime con NetworkFirst (offline = última
    copia consultada, fechada por su `updated` oficial).
11. **Diccionario ES por capas, sin inventar:** etiqueta propia ES →
    nombre oficial EN → código; los huecos se registran
    (`dictionaryGaps`). Cobertura verificada por test: 100 % de los
    valores por defecto y títulos de dimensión de las 33 fichas.

## 5. Verificación (cómo reproducirla)

- `npm test` — **142/142** (Vitest+jsdom, 25 ficheros; incluye las 6
  regresiones de la ronda QA y la compatibilidad de enlaces legados).
- `npm run test:e2e` — **13/13** en Chromium real contra `vite preview`
  con respuestas interceptadas (cuenta RF-08: transponer = 0 peticiones,
  ampliar = +1; RF-10 por separado: 413 demasiado grande vs en
  preparación vs sin datos). **Nota:** el harness bloquea el service
  worker por contexto (`serviceWorkers: 'block'`) porque los fetches
  internos de un SW no pasan por `page.route` en esta versión de
  Playwright; el SW se verifica por el contenido de `dist/sw.js`.
- `npm run smoke:live` — consulta M1 real contra Eurostat: PASS
  (España 2025 = 38.161,7; `updated` 2026-10-22).
- `npm run build` — verde (ojo: el build ejecuta `tsc -b` también sobre
  los tests; `tsc --noEmit` puede dar verde con la build en rojo).
- Smoke de producción: descargar el bundle servido y buscar las marcas
  («Guardar una copia en mi navegador», «Descarga cancelada»…) +
  revisar `sw.js` (cachés `europivot-data|schema|geo|catalogue`).
  **Tras un aviso de despliegue, espera ~1 min antes de verificar:**
  la promoción del despliegue tarda y una comprobación inmediata dio
  un falso «sigue el código viejo» en esta misma ronda.

## 6. Limitaciones y cabos sueltos (declarados, no empezar sin orden de Jon)

- **T05c (propuesto, NO aprobado):** barrido automático de los 8.887
  datasets para generar fichas «automáticas, sin verificar».
- **Diccionario:** codelists muy largas (121 conceptos de cuentas
  nacionales, NACE completa) degradan al nombre oficial EN con el
  hueco registrado; traducirlas es trabajo incremental seguro.
- **«EU trade with China» fuera del pack:** su fuente es Comext
  (códigos `DS-`), sin vía de esquema SDMX ESTAT para el constructor.
- **Modo offline verificado por configuración, NO por comportamiento
  (distinción señalada por Codex al revisar este traspaso):** los
  13/13 E2E corren con el SW bloqueado por contexto; lo probado del
  SW es su contenido (`dist/sw.js` y el servido en producción). La
  prueba decisiva — abrir un panel con red, desconectar y recargar
  con el SW activo — queda preparada en
  `scripts/e2e-offline-live.mjs` y debe ejecutarse en un entorno
  cuyo Chromium alcance ec.europa.eu (el de la VM del agente no
  puede). Hasta que alguien la corra, la recuperación offline es
  «implementada y configurada», no «demostrada».
- **Vercel Analytics:** código integrado; la activación en el panel de
  Vercel es manual de Jon.
- **Conector Vercel del agente:** sin acceso de lectura a los
  despliegues de su equipo (403); el estado de despliegues se verifica
  por la web pública o por el status «Vercel» que la integración deja
  en cada commit de GitHub. **El despliegue en Vercel lo hace Jon**;
  «Redeploy» sobre un despliegue existente reconstruye su fuente
  antigua — para publicar código nuevo hay que crear el despliegue
  desde la rama `main` (lección de esta ronda, con captura suya).

## 7. Reglas de trabajo del propietario (aplican a cualquier agente)

- Órdenes de **una tarea cada vez**; no abrir frentes sin su palabra.
- «Terminado» = **en producción y verificado**, no construido en local.
- Commits con su identidad GitHub (`Jon Peciña
  <jpecinagithub@users.noreply.github.com>`); a GitHub solo sube
  código del proyecto. Vercel no se toca sin orden expresa de una
  sola tarea. Nunca entrar en sus cuentas desde navegador automatizado.
- Comunicación en español, directa y con evidencia; si algo sale mal,
  se declara con su mecanismo, sin envoltorio.
