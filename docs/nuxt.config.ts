export default defineNuxtConfig({
    extends: ['docus'],
    compatibilityDate: '2024-04-03',
    routeRules: {
        '/favicon.ico': {
            redirect: 'https://www.stamhoofd.be/docs/content/images/2022/10/logo-small.svg',
        },
    },
    vite: {
        server: {
            allowedHosts: true, // host already checked
        },
    },
});
