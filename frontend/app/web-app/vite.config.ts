import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared.js';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...await buildConfig({
        name: 'web-app',
        port: 8080,
        clientFiles: [
            './main.ts',
            './src/App.vue',
        ],
    }),
} as any);
