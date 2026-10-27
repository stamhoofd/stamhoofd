import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: ['./vite.config.ts', './vitest.browser.config.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
