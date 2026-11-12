import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import viteSvgToWebfont from 'vite-svg-2-webfont';
import iconConfig from '@stamhoofd/assets/images/icons/icons.font.js';

const iconsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/shared/assets/images/icons/');

export default defineNuxtConfig({
    extends: ['docus'],
    site: {
        name: 'Stamhoofd Documentatie',
    },
    icon: {
        customCollections: [{
            prefix: 'stamhoofd',
            dir: iconsDir,
        }],
    },
    content: {
        build: {
            markdown: {
                toc: {
                    depth: 4,
                    searchDepth: 4,
                },
                highlight: {
                    theme: {
                        default: 'github-light',
                        // Override the inherited light theme, which takes precedence over default.
                        light: 'github-light',
                        dark: 'github-dark',
                    },
                },
            },
        },
    },
    modules: [
        '@node/nuxt-observability',
        (_, nuxt) => {
            nuxt.hook('vite:extendConfig', (config) => {
                if (config.optimizeDeps?.include) {
                    config.optimizeDeps.include = config.optimizeDeps.include.map(id => id.replace(/^@nuxtjs\/mdc > /, 'docus > @nuxtjs/mdc > '));
                }
            });
        },
    ],
    compatibilityDate: '2024-04-03',
    css: [
        // Generates the st-icons webfont + the ::before glyphs for .error-box,
        // .info-box, .warning-box and .success-box (see iconCss.hbs).
        'virtual:vite-svg-2-webfont.css',
        '~/assets/stamhoofd.scss',
        '~/assets/site-theme.scss',
        '~/assets/search-theme.scss',
        '~/assets/docs-theme.scss',
    ],
    routeRules: {
        '/favicon.ico': {
            redirect: '/favicon.svg',
        },
    },
    vite: {
        plugins: [
            viteSvgToWebfont({
                ...iconConfig,
                context: iconsDir,
                cssTemplate: resolve(iconsDir, 'iconCss.hbs'),
                moduleId: 'vite-svg-2-webfont.css',
            }),
        ],
        css: {
            preprocessorOptions: {
                scss: {
                    silenceDeprecations: ['color-functions', 'slash-div'],
                },
            },
        },
        server: {
            allowedHosts: true, // host already checked
        },
    },
});
