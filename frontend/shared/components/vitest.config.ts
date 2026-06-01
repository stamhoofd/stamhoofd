import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

process.env.TZ = 'UTC';
process.env.NODE_ENV = 'test';

export default defineConfig({
    plugins: [vue()],
    test: {
        watch: false,
        globals: true,
        include: ['src/**/*.test.ts'],
        setupFiles: ['vitest-browser-vue', '../../tests/vitest.setup.ts'],
        browser: {
            provider: 'playwright',
            enabled: true,
            headless: true,
            instances: [
                { browser: 'chromium' },
            ],
        },
    },
});
