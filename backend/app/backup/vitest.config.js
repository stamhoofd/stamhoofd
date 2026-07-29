import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.test.ts'],
        globalSetup: './tests/vitest.global.setup.ts',
        setupFiles: ['./tests/vitest.setup.ts'],
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: true,
        maxWorkers: 1,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
