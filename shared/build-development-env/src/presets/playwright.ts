export function build(): any {
    const playwrightWorkerId = process.env.PLAYWRIGHT_WORKER_ID;

    if (playwrightWorkerId === undefined) {
        throw new Error('PLAYWRIGHT_WORKER_ID is not set');
    }

    if (process.env.PORT === undefined) {
        throw new Error('PORT is not set');
    }

    const config = {
        PORT: process.env.PORT,
        domains: {
            dashboard: `playwright-dashboard-${playwrightWorkerId}.stamhoofd`,
            registration: {
                '': `playwright-registration-${playwrightWorkerId}.stamhoofd`,
            },
            marketing: {
                '': `playwright-marketing-${playwrightWorkerId}.stamhoofd`,
            },
            webshop: {
                '': `playwright-shop-${playwrightWorkerId}.stamhoofd`,
            },
            api: `playwright-api-${playwrightWorkerId}.stamhoofd`,
            rendererApi: `playwright-renderer-${playwrightWorkerId}.stamhoofd`,
            // defaultTransactionalEmail: {
            //     '': 'stamhoofd.be',
            //     'NL': 'stamhoofd.nl',
            // },

            // defaultBroadcastEmail: {
            //     '': 'stamhoofd.email',
            // },
            webshopCname: `playwright-shop-${playwrightWorkerId}.stamhoofd`,
        },
        DB_HOST: '127.0.0.1',
        DB_USER: 'root',
        DB_PASS: 'root',
        DB_DATABASE: `stamhoofd-playwright-${playwrightWorkerId}`,
    };

    return config;
}
