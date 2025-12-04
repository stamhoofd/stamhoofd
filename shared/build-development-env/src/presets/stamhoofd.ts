import { Service } from '../Service.js';

export function build(service: Service): any {
    const config = {
        domains: {
            dashboard: 'dashboard.stamhoofd',
            registration: {
                '': 'be.registration.stamhoofd',
                'BE': 'be.registration.stamhoofd',
                'NL': 'nl.registration.stamhoofd',
            },
            marketing: {
                '': 'www.be.stamhoofd',
                'BE': 'www.be.stamhoofd',
                'NL': 'www.nl.stamhoofd',
            },
            webshop: {
                '': 'be.shop.stamhoofd',
                'BE': 'be.shop.stamhoofd',
                'NL': 'nl.shop.stamhoofd',
            },
            api: 'api.stamhoofd',
            rendererApi: 'renderer.stamhoofd',

            defaultTransactionalEmail: {
                '': 'stamhoofd.be',
                'NL': 'stamhoofd.nl',
            },

            defaultBroadcastEmail: {
                '': 'stamhoofd.email',
            },
            webshopCname: 'shop.stamhoofd',
            registrationCname: 'registration.stamhoofd',
        },
        userMode: 'organization',
        translationNamespace: 'stamhoofd',
        platformName: 'stamhoofd',

        DB_DATABASE: 'stamhoofd-development',
        STRIPE_CONNECT_METHOD: 'express',
    };

    return config;
}
