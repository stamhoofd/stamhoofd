import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path, { resolve } from 'path';
import viteSvgToWebfont from 'vite-svg-2-webfont';

import { type ViteUserConfig } from 'vitest/config';
import iconConfig from './shared/assets/images/icons/icons.font';
import svgNamespacePlugin from './svgNamespacePlugin';

const use_env: Record<string, string> = {};

// This is a debug config as a replacement for process.env.NODE_ENV which seems to break webpack 5
// process.env.BUILD_FOR_PRODUCTION

if (process.env.NODE_ENV === 'production') {
    console.log('Building for production...');
}

let loadedEnv: FrontendEnvironment | undefined = undefined;

if (process.env.LOAD_ENV) {
    // Load this in the environment
    const decode = JSON.parse(process.env.LOAD_ENV);

    if (!decode.userMode || !decode.translationNamespace) {
        throw new Error('Invalid env file: missing some variables');
    }

    // We restringify to make sure encoding is minified
    loadedEnv = decode;
    use_env['STAMHOOFD'] = JSON.stringify(decode);
    use_env['process.env.NODE_ENV'] = JSON.stringify(decode.environment === 'production' ? 'production' : 'development');
}
else if (process.env.ENV_FILE) {
    // Reading environment from a JSON env file (JSON is needed)
    const file = path.resolve(process.env.ENV_FILE);

    // Load this in the environment
    const contents = fs.readFileSync(file, { encoding: 'utf-8' });
    const decode = JSON.parse(contents);
    const node_env = JSON.stringify(decode.environment === 'production' ? 'production' : 'development');

    if (!decode.userMode || !decode.translationNamespace) {
        throw new Error('Invalid env file: missing some variables');
    }

    console.log('Using environment file: ' + file);

    loadedEnv = decode;
    const stamhoofdEnv = JSON.stringify(decode);

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env['STAMHOOFD'] = stamhoofdEnv;

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env['process.env.NODE_ENV'] = node_env;
}
else {
    throw new Error('ENV_FILE or LOAD_ENV environment variables are missing');
}

// https://vitejs.dev/config/
export function buildConfig(options: { port: number; clientFiles?: string[] }): ViteUserConfig {
    return {
        mode: process.env.NODE_ENV !== 'production' ? 'development' : 'production',
        logLevel: 'warn', // Options are 'info', 'warn', 'error', and 'silent'
        resolve: {
            alias: {
                '@stamhoofd/components': resolve(__dirname, './shared/components'),
            },
            dedupe: [
                // When yarn linking packages - the issue is that dependencies are resolved to the local node_modules folder in the linked package
                // this can cause type issues because multiple versions of the same package are loaded
                '@simonbackx/simple-encoding',
                '@simonbackx/simple-database',
            ],
        },
        plugins: [
            svgNamespacePlugin({
                namespace: loadedEnv?.ILLUSTRATIONS_NAMESPACE ?? '',
                colors: loadedEnv?.ILLUSTRATIONS_COLORS,
            }),
            vue({
                template: {
                    compilerOptions: {
                        comments: false,
                    },
                },
            }),
            viteSvgToWebfont({
                ...iconConfig,
                context: resolve(__dirname, './shared/assets/images/icons/'),
                cssTemplate: resolve(__dirname, './shared/assets/images/icons/iconCss.hbs'),
            }),
        ] as any,
        define: use_env,
        server: process.env.NODE_ENV !== 'production'
            ? {
                    host: '127.0.0.1',
                    port: options.port,
                    strictPort: true,
                    warmup: {
                        clientFiles: [
                            ...(options?.clientFiles ?? []),
                            resolve(__dirname, './shared') + '/**/*.vue',
                            resolve(__dirname, './shared') + '/**/*.ts',
                        ],
                    },
                }
            : undefined,
        build: process.env.NODE_ENV !== 'production'
            ? {
                    sourcemap: 'inline',
                    rollupOptions: {
                        treeshake: false, // Increases performance
                    },
                    watch: {
                        buildDelay: 1000,
                    },
                }
            : {
                    sourcemap: true,
                },
        publicDir: resolve(__dirname, './public'),
        test: {
            setupFiles: ['vitest-browser-vue', __dirname + '/tests/vitest.setup.ts'],
            browser: {
                provider: 'playwright', // or 'webdriverio'
                enabled: true,
                headless: true,
                // at least one instance is required
                instances: [
                    { browser: 'chromium' },
                ],
            },
        },
        optimizeDeps: { exclude: ['fsevents'] },
    };
}
