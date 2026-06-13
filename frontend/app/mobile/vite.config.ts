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
    }),
} as any);
