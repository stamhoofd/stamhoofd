import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: false,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
