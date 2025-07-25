import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...await buildConfig({
        name: 'dashboard',
        port: 8080,
    }),
} as any);
