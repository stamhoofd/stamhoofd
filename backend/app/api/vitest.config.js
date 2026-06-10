import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globalSetup: './tests/vitest.global.setup.ts',
        setupFiles: ['./tests/vitest.setup.ts'],
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: true,
        testTimeout: 10_000, // required for slow CI
        maxWorkers: 1, // For now we can't run parallel because all test files use the same database
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            exclude: ['src/migrations/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
