import { describe, expect, test } from 'vitest';
import { getVendorChunkName } from './vendorChunkName.js';

describe('getVendorChunkName', () => {
    test.each([
        ['/repo/node_modules/parent/node_modules/child/index.js', 'vendor-child'],
        // yarn node_modules format:
        ['/repo/node_modules/vue/dist/vue.js', 'vendor-vue'],
        ['/repo/node_modules/@vitejs/plugin-vue/dist/index.js', 'vendor-@vitejs/plugin-vue'],
        // pnpm uses a .pnpm subfolder and symlinks unlike yarn.
        ['/repo/node_modules/.pnpm/vue@3.5.40/node_modules/vue/dist/vue.js', 'vendor-vue'],
        ['/repo/node_modules/.pnpm/@vitejs+plugin-vue@6.0.8/node_modules/@vitejs/plugin-vue/dist/index.js', 'vendor-@vitejs/plugin-vue'],
    ])('returns the package chunk for %s', (id, expected) => {
        expect(getVendorChunkName(id)).toBe(expected);
    });

    test('returns undefined for source files', () => {
        expect(getVendorChunkName('/repo/frontend/app/web-app/src/main.ts')).toBeUndefined();
    });

    test('returns undefined for malformed scoped package paths', () => {
        expect(getVendorChunkName('/repo/node_modules/@vitejs')).toBeUndefined();
    });
});
