import { Service } from '../Service';

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
        },
        translationNamespace: 'keeo',
        platformName: 'keeo',
        fixedCountry: 'BE',
        DB_DATABASE: 'stamhoofd-keeo',

        // Enable member numbers
        MEMBER_NUMBER_ALGORITHM: 'Incremental',
        MEMBER_NUMBER_ALGORITHM_LENGTH: 10,
    };

    return config;
}
