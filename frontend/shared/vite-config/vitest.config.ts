import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        globals: true,
        environment: 'node',
        root: import.meta.dirname,
    },
});
