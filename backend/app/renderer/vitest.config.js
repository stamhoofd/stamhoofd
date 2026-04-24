import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globalSetup: './tests/vitest.global.setup.ts',
        setupFiles: ['./tests/vitest.setup.ts'],
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: true,
        maxWorkers: 1, // For now we can't run parallel because all test files use the same database
    },
});
