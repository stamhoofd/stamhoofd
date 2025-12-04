import { Service } from '../Service.js';

export function build(service: Service): any {
    const config = {
        presets: ['platform'],
        domains: {
            dashboard: 'jambo.dashboard.stamhoofd',
            marketing: {
                '': 'jamboree2027.be',
            },
            webshop: {
                '': 'jambo.shop.stamhoofd',
            },
            api: 'jambo.api.stamhoofd',
            rendererApi: 'jambo.renderer.stamhoofd',

            defaultTransactionalEmail: {
                '': 'stamhoofd.be',
                'NL': 'stamhoofd.nl',
            },

            defaultBroadcastEmail: {
                '': 'stamhoofd.email',
            },
            webshopCname: 'jambo.shop.stamhoofd',
        },
        translationNamespace: 'jamboree',
        platformName: 'jamboree',
        fixedCountry: 'BE',
        DB_DATABASE: 'stamhoofd-jamboree',
        locales: {
            BE: ['nl', 'fr'],
        },
        singleOrganization: '1d444815-3213-4a16-9846-91a41f2de9a4',

        // Enable member numbers
        MEMBER_NUMBER_ALGORITHM: 'Incremental',
        MEMBER_NUMBER_ALGORITHM_LENGTH: 10,
    };

    return config;
}
