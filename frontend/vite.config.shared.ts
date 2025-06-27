import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path, { resolve } from 'path';
import viteSvgToWebfont from 'vite-svg-2-webfont';

import { type ViteUserConfig } from 'vitest/config';
import iconConfig from './shared/assets/images/icons/icons.font';
import svgNamespacePlugin from './svgNamespacePlugin';

// https://vitejs.dev/config/
export async function buildConfig(options: { name: 'dashboard' | 'registration' | 'webshop'; port: number; clientFiles?: string[] }): Promise<ViteUserConfig> {
    if (process.env.NODE_ENV === 'production') {
        console.log('Building for production...');
    }

    let loadedEnv: FrontendEnvironment | undefined = undefined;

    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        const builder = await import('@stamhoofd/build-development-env');
        loadedEnv = await builder.build(process.env.STAMHOOFD_ENV ?? '', {
            frontend: options.name,
        });
    }
    else if (process.env.LOAD_ENV) {
        // Load this in the environment
        const decode = JSON.parse(process.env.LOAD_ENV);

        // We restringify to make sure encoding is minified
        loadedEnv = decode;
    }
    else if (process.env.ENV_FILE) {
        // Reading environment from a JSON env file (JSON is needed)
        const file = path.resolve(process.env.ENV_FILE);

        // Load this in the environment
        const contents = fs.readFileSync(file, { encoding: 'utf-8' });
        const decode = JSON.parse(contents);
        loadedEnv = decode;
    }

    if (!loadedEnv) {
        throw new Error('Failed to load environment variables');
    }

    // Validation
    if (!loadedEnv.userMode || !loadedEnv.translationNamespace) {
        console.error('Invalid environement:', loadedEnv);
        throw new Error('Invalid environement: missing some variables');
    }

    // Build env
    const use_env: Record<string, string> = {};

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env['STAMHOOFD'] = JSON.stringify(loadedEnv);

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env['process.env.NODE_ENV'] = JSON.stringify(loadedEnv.environment === 'production' ? 'production' : 'development');

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
                    port: loadedEnv.PORT ?? options.port,
                    strictPort: true,
                    allowedHosts: ['.stamhoofd'],
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
            globals: true,
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
