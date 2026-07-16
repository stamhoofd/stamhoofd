import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import viteSvgToWebfont from 'vite-svg-2-webfont';
import iconConfig from '@stamhoofd/assets/images/icons/icons.font.js';

const iconsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/shared/assets/images/icons/');

export default defineNuxtConfig({
    extends: ['docus'],
    compatibilityDate: '2024-04-03',
    css: [
        // Generates the st-icons webfont + the ::before glyphs for .error-box,
        // .info-box, .warning-box and .success-box (see iconCss.hbs).
        'virtual:vite-svg-2-webfont.css',
        '~/assets/stamhoofd.scss',
    ],
    routeRules: {
        // Browsers ask for /favicon.ico; we ship the logo as an SVG in public/.
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
