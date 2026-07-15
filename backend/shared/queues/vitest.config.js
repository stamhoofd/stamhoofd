import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['**/*.test.ts'], // only match TypeScript sources, so compiled copies in dist are never picked up
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: true,
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
