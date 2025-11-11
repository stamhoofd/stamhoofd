import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path, { resolve } from 'path';
import viteSvgToWebfont from 'vite-svg-2-webfont';

import postcssDiscardDulicates from 'postcss-discard-duplicates';
import { type ViteUserConfig } from 'vitest/config';
import iconConfig from './shared/assets/images/icons/icons.font';
import svgNamespacePlugin from './svgNamespacePlugin';

// https://vitejs.dev/config/
export async function buildConfig(options: { name: 'dashboard' | 'registration' | 'webshop' | 'calculator'; port: number; clientFiles?: string[] }): Promise<ViteUserConfig> {
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
            const builder = await import('@stamhoofd/test-utils/cjs');
            await builder.TestUtils.loadEnvironment();
            loadedEnv = STAMHOOFD;
        }
        else if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            console.log('Building for development...', process.env.NODE_ENV);
            const builder = await import('@stamhoofd/build-development-env');
            const builtEnv = await builder.build(process.env.STAMHOOFD_ENV ?? '', {
                frontend: options.name,
            });

            loadedEnv = builtEnv;
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

        // use runtimeValue, because cache can be optimized if webpack knows which cache to get
        use_env['STAMHOOFD'] = JSON.stringify(loadedEnv);

        // use runtimeValue, because cache can be optimized if webpack knows which cache to get
        use_env['process.env.NODE_ENV'] = JSON.stringify(loadedEnv.environment);
    }

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
            viteSvgToWebfont({
                ...iconConfig,
                context: resolve(__dirname, './shared/assets/images/icons/'),
                cssTemplate: resolve(__dirname, './shared/assets/images/icons/iconCss.hbs'),
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
                            resolve(__dirname, './shared') + '/**/*.vue',
                            resolve(__dirname, './shared') + '/**/*.ts',
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
                        treeshake: true, // Increases performance
                        output: {
                            manualChunks: undefined, // disable any auto chunk splitting
                            inlineDynamicImports: true, // This is needed to make sure that the dynamic imports are inlined
                        },
                    },
                    watch: {
                        buildDelay: 1000,
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
                                treeshake: 'smallest', // Increases performance
                            },
                        }
                    : {
                            sourcemap: true,
                            cssCodeSplit: false,
                            outDir: isPlaywrightBuild ? 'dist-playwright' : undefined,
                        }),
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
        css: {
            postcss: {
                plugins: [
                    postcssDiscardDulicates,
                ],
            },
            preprocessorOptions: {
                scss: {
                    // Scss will change in a future version to resolve &'s in the same order as native CSS.
                    // This is a pretty big change in the code base, and probably won't really affect us.
                    // We'll need to fix this when SCSS changes the resolution order in the next version.
                    // More info at https://sass-lang.com/d/mixed-decls
                    // color-functions: deprecated some aliasses. Easy to fix later.
                    silenceDeprecations: ['mixed-decls', 'color-functions'],
                },
            },
        },
    };
}
