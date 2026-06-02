import { defineConfig } from 'vite';

import { buildConfig } from '../../vite.config.shared';

// Set timezone!
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
const config = await buildConfig({
    name: 'dashboard',
    port: 0,
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig({
    ...config,
    test: {
        ...config.test,
        include: ['src/**/*.test.ts'],
    },
} as any);
