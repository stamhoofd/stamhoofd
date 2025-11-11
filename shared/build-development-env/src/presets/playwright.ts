export function build(): any {
    const playwrightWorkerId = process.env.PLAYWRIGHT_WORKER_ID;

    if (playwrightWorkerId === undefined) {
        throw new Error('PLAYWRIGHT_WORKER_ID is not set');
    }

    const config = {
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
    };

    if (process.env.PORT) {
        (config as any).PORT = process.env.PORT;
    }

    return config;
}
