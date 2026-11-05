import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// EUROPIVOT — SDD §4.1/§4.2: Vite + React + TS, Tailwind, PWA (RNF-02).
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'EUROPIVOT — Datos de Eurostat en tablas dinámicas',
        short_name: 'EUROPIVOT',
        description:
          'Compara países, entiende la diferencia y comparte el resultado. Dashboard tipo pivot table sobre la API de Eurostat.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#090c16',
        theme_color: '#090c16',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cáscara offline (RNF-02). Los datos de Eurostat se cachean en la capa
        // de cliente (TanStack Query, T02+), nunca en el service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // El índice del catálogo (2,3 MB, T04) es un chunk perezoso de
        // datos, no cáscara: precachearlo rompería el límite de 2 MiB de
        // workbox y penalizaría la instalación. Se cachea en tiempo de
        // ejecución la primera vez que la Home lo pide (T07).
        globIgnores: ['**/catalogue-index-*.js'],
        runtimeCaching: [
          {
            urlPattern: /catalogue-index-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'europivot-catalogue',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // QA 2026-11-05 (offline): sin conexión se recuperaba la
          // portada pero no el último panel consultado. NetworkFirst:
          // con red manda lo fresco de Eurostat; sin red, la última
          // copia vista (el panel muestra su fecha `updated`).
          {
            urlPattern: /^https:\/\/ec\.europa\.eu\/eurostat\/api\/dissemination\/statistics\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'europivot-data',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/ec\.europa\.eu\/eurostat\/api\/dissemination\/sdmx\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'europivot-schema',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/gisco-services\.ec\.europa\.eu\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'europivot-geo',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
