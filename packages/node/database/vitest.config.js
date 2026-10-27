import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // ... Specify options here.
        globalSetup: './tests/vitest.global.setup.ts',
        watch: false,
        globals: true,
        root: 'src',
    },
});
