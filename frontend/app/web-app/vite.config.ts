import { defineConfig } from 'vite';
import { resolve } from 'path';
import { buildConfig } from '@stamhoofd/vite-config';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...await buildConfig({
        name: 'web-app',
        port: 8080,
        frontendDir: resolve(import.meta.dirname, '../..'),
        clientFiles: [
            './main.ts',
            './src/App.vue',
        ],
    }),
    html: {
        // Placeholder nonce for the web-app's strict-dynamic Content-Security-Policy.
        // Vite injects this value into a <meta property="csp-nonce"> tag and onto every
        // generated <script>/<style>/preload tag, and its runtime preload helper reuses
        // it for lazily loaded chunks. Caddy replaces the placeholder with a real,
        // per-request nonce and sets the matching CSP header (see devops buildCaddyConfig.ts).
        // Keep this string in sync with `CSP_NONCE_PLACEHOLDER` in @stamhoofd/cli and the
        // manual nonce="..." attributes in index.html and shared/public/out-of-date.html.
        // NOTE: the mobile app also builds with buildConfig({ name: 'web-app' }) but has its own
        // vite.config.ts without this option — it is served from the device (no Caddy to set the
        // header / rewrite the nonce), so it keeps its meta-tag CSP instead.
        cspNonce: 'STAMHOOFD_CSP_NONCE',
    },
} as any);
