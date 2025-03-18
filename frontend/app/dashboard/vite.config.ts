import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
export default defineConfig({
    ...buildConfig({
        port: 8080,
        clientFiles: [
            './main.ts',
            './src/App.vue',
            './src/getRootViews.ts',
        ],
    }),
});
