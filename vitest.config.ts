import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        projects: [
            'frontend/app/*/{vite,vitest}.config.{js,ts}',
            'frontend/shared/*/{vite,vitest}.config.{js,ts}',
            'shared/*/{vite,vitest}.config.{js,ts}',
            'packages/common/errors/vitest.config.js',
            'packages/common/encoding/vitest.config.js',
            'backend/shared/*/{vite,vitest}.config.{js,ts}',
            'backend/app/*/{vite,vitest}.config.{js,ts}',
        ],
    },
});
