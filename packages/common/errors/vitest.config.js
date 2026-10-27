import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        watch: false,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
