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
        server: {
            deps: {
                inline: [
                    '@simonbackx/simple-database',
                ],
            },
        },
    },
});
