import { buildConfig } from '@stamhoofd/vite-config';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

process.env.TZ = 'UTC';

export default defineConfig(await buildConfig({
    name: 'web-app',
    port: 0,
    frontendDir: resolve(import.meta.dirname, '../..'),
}));
