import { defineConfig } from 'vite';
import { resolve } from 'path';
import { buildConfig } from '@stamhoofd/vite-config';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...await buildConfig({
        name: 'webshop',
        port: 8082,
        frontendDir: resolve(import.meta.dirname, '../..'),
    }),
    html: {
        // Placeholder nonce for the webshop's strict-dynamic Content-Security-Policy.
        // Vite injects this value into a <meta property="csp-nonce"> tag and onto every
        // generated <script>/<style>/preload tag, and its runtime preload helper reuses
        // it for lazily loaded chunks. Caddy replaces the placeholder with a real,
        // per-request nonce and sets the matching CSP header (see devops buildCaddyConfig.ts).
        // Keep this string in sync with `cspNoncePlaceholder` over there and with the manual
        // nonce="..." attributes in index.html and shared/public/out-of-date.html.
        cspNonce: 'STAMHOOFD_CSP_NONCE',
    },
} as any);
