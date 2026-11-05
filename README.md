# EUROPIVOT

**Compara países, entiende la diferencia, comparte el resultado.**

Dashboard web tipo *pivot table* sobre la API pública de Eurostat: eliges un
dataset, arrastras dimensiones a filas, columnas y filtros, y la tabla, el
gráfico y el mapa se actualizan al momento. Sin backend, sin claves: Eurostat
ofrece sus datos en abierto (fuente: Eurostat, con atribución en cada vista y
exportación).

- **Spec (fuente de verdad):** [`SDD-MASTER.md`](./SDD-MASTER.md) — constitución,
  requisitos RF en formato EARS, plan técnico y tareas T00–T16.
- **Estado:** T01 (andamiaje) — Vite + React + TypeScript + Tailwind, PWA,
  Vercel Analytics, estructura de capas del SDD §4.2.
- **Desarrollo:** `npm install` → `npm run dev` · **Tests:** `npm test` ·
  **Build:** `npm run build` · **Lint:** `npm run lint`.

Un proyecto de Jon Peciña — jpecina@gmail.com
