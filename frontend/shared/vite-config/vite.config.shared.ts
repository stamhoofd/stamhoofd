import type { FrontendEnvironment } from '@stamhoofd/types/Environment';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path, { resolve } from 'path';
import viteSvgToWebfont from 'vite-svg-2-webfont';
import { playwright } from '@vitest/browser-playwright';
import postcssDiscardDulicates from 'postcss-discard-duplicates';
import type { ViteUserConfig } from 'vitest/config';
import iconConfig from '@stamhoofd/assets/images/icons/icons.font.js';
import svgNamespacePlugin from '@stamhoofd/vite-config/svgNamespacePlugin';
import hmrReconnectPlugin from '@stamhoofd/vite-config/hmrReconnectPlugin';

// https://vitejs.dev/config/
export async function buildConfig(options: { name: 'web-app' | 'webshop' | 'calculator'; port: number; clientFiles?: string[]; frontendDir: string }): Promise<ViteUserConfig> {
    if (process.env.NODE_ENV === 'production') {
        console.log('Building for production...');
    }

    const isPlaywrightBuild = process.env.STAMHOOFD_ENV === 'playwright';

    // Build env
    const use_env: Record<string, string> = {};
    let loadedEnv: FrontendEnvironment | undefined = undefined;

    if (!isPlaywrightBuild) {
        if (process.env.NODE_ENV && process.env.NODE_ENV === 'test') {
        // Force load the cjs version of test-utils because the esm version gives issues with the json environment
            const builder = await import('@stamhoofd/test-utils');
            builder.TestUtils.loadEnvironment();
            loadedEnv = STAMHOOFD;
        } else if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            console.log('Building env for development...', process.env.NODE_ENV);
            const builder = await import('@stamhoofd/cli');
            const builtEnv = await builder.buildDevelopmentEnvironment(process.env.STAMHOOFD_ENV ?? '', {
                frontend: options.name,
            });
            console.log('Built env for development.', process.env.NODE_ENV);

            loadedEnv = builtEnv;
        } else if (process.env.LOAD_ENV) {
        // Load this in the environment
            const decode = JSON.parse(process.env.LOAD_ENV);

            // We restringify to make sure encoding is minified
            loadedEnv = decode;
        } else if (process.env.ENV_FILE) {
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

        // use runtimeValue, because cache can be optimized if webpack knows which cache to get
        use_env['STAMHOOFD'] = JSON.stringify(loadedEnv);

        // use runtimeValue, because cache can be optimized if webpack knows which cache to get
        use_env['process.env.NODE_ENV'] = JSON.stringify(loadedEnv.environment);
    }

    const frontendDir = options.frontendDir;

    return {
        mode: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' ? 'development' : 'production',
        logLevel: 'warn', // Options are 'info', 'warn', 'error', and 'silent'
        resolve: {
            dedupe: [
                // When yarn linking packages - the issue is that dependencies are resolved to the local node_modules folder in the linked package
                // this can cause type issues because multiple versions of the same package are loaded
                '@simonbackx/simple-encoding',
                '@simonbackx/simple-database',
            ],
        },
        plugins: [
            // Keeps the page from full-reloading when the HMR socket drops
            // (e.g. on a Caddy config reload). Dev-only via apply: 'serve'.
            hmrReconnectPlugin(),
            viteSvgToWebfont({
                ...iconConfig,
                context: resolve(frontendDir, './shared/assets/images/icons/'),
                cssTemplate: resolve(frontendDir, './shared/assets/images/icons/iconCss.hbs'),
                moduleId: options.name === 'calculator' ? 'vite-svg-2-webfont.css?inline' : 'vite-svg-2-webfont.css',
            }),
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
                features: {
                    customElement: options.name === 'calculator', // Only enable custom elements for the calculator
                },
            }),
        ] as any,
        define: isPlaywrightBuild ? undefined : use_env,
        server: process.env.NODE_ENV !== 'production' && !isPlaywrightBuild
            ? {
                    host: '127.0.0.1',
                    port: loadedEnv?.PORT ?? options.port,
                    strictPort: true,
                    allowedHosts: ['.stamhoofd'],
                    warmup: {
                        clientFiles: [
                            ...(options?.clientFiles ?? []),
                            // '.main/.ts',
                        ],
                    },
                }
            : undefined,
        preview: process.env.NODE_ENV !== 'production' && !isPlaywrightBuild
            ? {
                    host: '127.0.0.1',
                    port: loadedEnv?.PORT ?? options.port,
                    strictPort: true,
                    allowedHosts: ['.stamhoofd'],
                }
            : undefined,
        build: process.env.NODE_ENV !== 'production' && !isPlaywrightBuild
            ? {
                    sourcemap: 'inline',
                    rollupOptions: {
                        treeshake: true,
                        output: {
                            // One chunk per npm package > ~3 KB. Cache invalidation
                            // becomes per-library instead of per-app-revision.
                            manualChunks(id) {
                                if (id.includes('node_modules')) {
                                    const pkg = id.match(/node_modules\/([^/]+)/)?.[1];
                                    if (pkg) return `vendor-${pkg}`;
                                }
                            },
                        },
                    },
                    cssCodeSplit: false,
                }
            : (options.name === 'calculator'
                    ? {
                            lib: {
                                name: 'StamhoofdCalculator',
                                fileName: 'calculator',
                                entry: './src/index.ts',
                            },
                            rollupOptions: {
                                treeshake: true,
                            },
                        }
                    : {
                            sourcemap: true,
                            cssCodeSplit: false,
                            outDir: isPlaywrightBuild ? 'dist-playwright' : undefined,
                            rollupOptions: {
                                output: {
                                    // One chunk per npm package > ~3 KB. Cache invalidation
                                    // becomes per-library instead of per-app-revision.
                                    manualChunks(id) {
                                        if (id.includes('node_modules')) {
                                            const pkg = id.match(/node_modules\/([^/]+)/)?.[1];
                                            if (pkg) return `vendor-${pkg}`;
                                        }
                                    },
                                },
                            },
                        }),
        publicDir: resolve(frontendDir, './public'),
        test: {
            watch: false,
            globals: true,
            setupFiles: ['vitest-browser-vue', resolve(frontendDir, './tests/vitest.setup.ts')],
            browser: {
                provider: playwright({
                    actionTimeout: 5_000,
                }),
                enabled: true,
                headless: true,
                // at least one instance is required
                instances: [
                    { browser: 'chromium' },
                ],
            },
        },
        optimizeDeps: {
            exclude: ['fsevents', '@stamhoofd/*'],
        },
        css: {
            postcss: {
                plugins: [
                    postcssDiscardDulicates,
                ],
            },
            preprocessorOptions: {
                scss: {
                    // color-functions: deprecated some aliasses. Easy to fix later.
                    silenceDeprecations: ['color-functions', 'slash-div'],
                },
            },
        },
    };
}
