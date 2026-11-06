import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.test.ts'], // only match TypeScript sources, so compiled copies in dist are never picked up
        globalSetup: './tests/vitest.global.setup.ts',
        setupFiles: ['./tests/vitest.setup.ts'],
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
