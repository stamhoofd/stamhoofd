export default defineNuxtConfig({
    extends: ['docus'],
    compatibilityDate: '2024-04-03',
    routeRules: {
        // Browsers ask for /favicon.ico; we ship the logo as an SVG in public/.
        '/favicon.ico': {
            redirect: '/favicon.svg',
        },
    },
    vite: {
        server: {
            allowedHosts: true, // host already checked
        },
    },
});
