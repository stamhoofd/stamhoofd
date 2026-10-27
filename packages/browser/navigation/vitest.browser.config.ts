import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        root: 'src',
        include: ['**/*.browser.test.ts'],
        browser: {
            enabled: true,
            headless: true,
            provider: playwright({
                contextOptions: {
                    viewport: { width: 800, height: 600 },
                    recordVideo: {
                        dir: './test-results/videos',
                        size: { width: 800, height: 600 },
                    },
                },
            }),
            instances: [
                { browser: 'chromium' },
            ],
        },
    },
});
