import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        globals: true,
        root: import.meta.dirname,
        isolate: false,
    },
});
