import { Service } from '../Service.js';

export function build(service: Service): any {
    const config = {
        presets: ['platform'],
        domains: {
            dashboard: 'keeo.dashboard.stamhoofd',
            marketing: {
                '': 'fos.be',
            },
            webshop: {
                '': 'keeo.shop.stamhoofd',
            },
            api: 'keeo.api.stamhoofd',
            rendererApi: 'keeo.renderer.stamhoofd',

            defaultTransactionalEmail: {
                '': 'stamhoofd.be',
                'NL': 'stamhoofd.nl',
            },

            defaultBroadcastEmail: {
                '': 'stamhoofd.email',
            },
            webshopCname: 'keeo.shop.stamhoofd',
            documentation: {
                '': 'docs.keeo.fos.be',
            },
        },
        translationNamespace: 'keeo',
        platformName: 'keeo',
        fixedCountry: 'BE',
        DB_DATABASE: 'stamhoofd-keeo',
        FEEDBACK_URL: 'https://feedback.fos.be',

        // Enable member numbers
        MEMBER_NUMBER_ALGORITHM: 'Incremental',
        MEMBER_NUMBER_ALGORITHM_LENGTH: 10,
    };

    return config;
}
