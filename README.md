# EUROPIVOT

**Compara países, entiende la diferencia, comparte el resultado.**

Dashboard web tipo *pivot table* sobre la API pública de Eurostat: eliges un
dataset, arrastras dimensiones a filas, columnas y filtros, y la tabla, el
gráfico y el mapa se actualizan al momento. Sin backend, sin claves: Eurostat
ofrece sus datos en abierto (fuente: Eurostat, con atribución en cada vista y
exportación).

- **Spec (fuente de verdad):** [`SDD-MASTER.md`](./SDD-MASTER.md) — constitución,
  requisitos RF en formato EARS, plan técnico y tareas T00–T16.
- **Estado:** plan T01–T16 cerrado y en producción (2026-11-05) +
  ronda QA post-entrega de Jon corregida el mismo día (ver
  INFORME-FINAL.md §7); pendiente solo su redespliegue.
- **Desarrollo:** `npm install` → `npm run dev` · **Tests unitarios e
  integración (Vitest + jsdom):** `npm test` · **Build:** `npm run build` ·
  **Lint:** `npm run lint`.
- **E2E en navegador real (Playwright/Chromium contra `vite preview`,
  respuestas interceptadas con fixtures):** `npm run test:e2e` — arranque
  desde enlace, constructor completo, conteo de peticiones RF-08 y los dos
  estados de error RF-10 por separado.
- **Smoke en vivo contra la API real de Eurostat:** `npm run smoke:live`
  (consulta exacta de M1) y `node scripts/e2e-live.mjs` (el mismo recorrido
  en el navegador, sin interceptar; en entornos con egress restringido para
  navegadores puede no poder salir a ec.europa.eu — el smoke de API cubre
  entonces la pata de red).

Un proyecto de Jon Peciña — jpecina@gmail.com
