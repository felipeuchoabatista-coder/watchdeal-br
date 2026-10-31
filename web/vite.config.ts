import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = import.meta.dirname;
const dataDir = resolve(root, '..', process.env.WATCHDEAL_DATA_DIR ?? 'data');

// Temporários do build (o service worker é montado numa pasta temporária)
// ficam dentro do projeto, não na pasta temporária do sistema.
const projectTmp = resolve(root, '..', '.tmp');
mkdirSync(projectTmp, { recursive: true });
process.env.TMP = process.env.TEMP = process.env.TMPDIR = projectTmp;

/** Em desenvolvimento, serve a pasta data/ (gerada pelo coletor) em /data. */
function serveData(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^[/\\]+/, '');
    const file = join(dataDir, rel);
    if (!file.startsWith(dataDir) || rel.startsWith('estado') || !existsSync(file) || !statSync(file).isFile()) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'watchdeal-data',
    configureServer: (server) => void server.middlewares.use('/data', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/data', handler),
  };
}

export default defineConfig({
  root,
  base: './',
  plugins: [
    react(),
    serveData(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        id: './',
        name: 'WatchDeal BR — promoções de smartwatch',
        short_name: 'WatchDeal',
        description: 'Promoções e cupons 24h para Galaxy Watch8, Galaxy Watch FE, Galaxy Watch4 e Xiaomi Watch 2.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        categories: ['shopping', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Dados: sempre tenta a versão mais nova; sem internet, usa a última salva.
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'watchdeal-dados',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 40, maxAgeSeconds: 14 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'watchdeal-imagens',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
