import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['index.ts', 'src/classes/data/*.ts'],
    format: ['cjs', 'esm'],
    unbundle: false, // SHIMS IS NOT COMPATIBLE WITH UNBUNDLE:TRUE!
    dts: true,
    sourcemap: true,
    shims: true, // SHIMS IS NOT COMPATIBLE WITH UNBUNDLE:TRUE!
    tsconfig: './tsconfig.build.json',
    outExtensions: () => ({
        dts: '.d.ts',
    }),
});
