import { defineConfig } from 'vitest/config';
import { buildConfig } from '../../vite.config.shared';

process.env.TZ = 'UTC';

const config = await buildConfig({
    name: 'dashboard',
    port: 0,
});

export default defineConfig({
    ...config,
    test: {
        watch: false,
        globals: true,
        environment: 'node',
    },
} as any);
