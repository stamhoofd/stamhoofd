import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // ... Specify options here.
        globalSetup: './tests/vitest.global.setup.ts',
        watch: false,
        globals: true,
        root: import.meta.dirname,
        include: ['src/**/*.test.ts'],
        setupFiles: ['./tests/vitest.setup.ts'],
        maxWorkers: 1,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
