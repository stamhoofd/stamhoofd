import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: { include: ['src/**/*.test.ts'], root: import.meta.dirname },
});
