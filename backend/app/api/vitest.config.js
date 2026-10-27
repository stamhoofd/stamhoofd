import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.test.ts'], // only match TypeScript sources, so compiled copies in dist are never picked up
        globalSetup: './tests/vitest.global.setup.ts',
        setupFiles: ['./tests/vitest.setup.ts'],
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: true,
        testTimeout: 10_000, // required for slow CI
        maxWorkers: 1, // For now we can't run parallel because all test files use the same database
        experimental: process.env.STAMHOOFD_TEST_PROFILE === '1'
            ? { importDurations: { print: true, limit: 30 } }
            : undefined,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            exclude: ['src/migrations/**'],
            reporter: ['text', 'html', 'lcov'],
        },
        server: {
            deps: {
                inline: [
                    // @node/endpoints and @simonbackx/simple-database do async imports inside the package
                    // we need to make sure Vitest also adds .ts support there
                    '@node/endpoints',
                    '@simonbackx/simple-database',
                ],
            },
        },
    },
});
