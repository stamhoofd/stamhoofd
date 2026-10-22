import { buildConfig } from '@stamhoofd/vite-config';
import { FrontendApp } from '@stamhoofd/types/FrontendApp';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

process.env.TZ = 'UTC';

export default defineConfig(await buildConfig({
    name: FrontendApp.WebApp,
    port: 0,
    frontendDir: resolve(import.meta.dirname, '../..'),
}));
