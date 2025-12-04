import { Service } from '../Service.js';

export function build(service: Service): any {
    const config = {
        presets: ['platform'],
        domains: {
            dashboard: 'ravot.dashboard.stamhoofd',
            marketing: {
                '': 'ksa.be',
            },
            webshop: {
                '': 'ravot.shop.stamhoofd',
            },
            api: 'ravot.api.stamhoofd',
            rendererApi: 'ravot.renderer.stamhoofd',

            defaultTransactionalEmail: {
                '': 'stamhoofd.be',
                'NL': 'stamhoofd.nl',
            },

            defaultBroadcastEmail: {
                '': 'stamhoofd.email',
            },
            webshopCname: 'ravot.shop.stamhoofd',
        },
        translationNamespace: 'digit',
        platformName: 'ravot',
        fixedCountry: 'BE',
        DB_DATABASE: 'stamhoofd-ravot',

        // Member numbers are KSA-specific
        MEMBER_NUMBER_ALGORITHM: MemberNumberAlgorithm.KSA,
    };

    return config;
}
