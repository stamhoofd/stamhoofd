/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        dts(),
    ],
    test: {
        watch: false,
        globals: true,
        root: 'src',
        exclude: ['**/*.browser.test.ts'],
    },
    build: {
        minify: false,

        lib: { // tell the build process to treat this project as library
            entry: {
                index: path.resolve(__dirname, './index.ts'),
            },
            name: 'vue-app-navigation',
            fileName: (_, entryName) => `${entryName}.js`,
            formats: ['es'],
        },
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: ['vue'],
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    vue: 'Vue',
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) return 'main.css';
                    return assetInfo.name ?? '';
                },
            },
        },
    },
});
