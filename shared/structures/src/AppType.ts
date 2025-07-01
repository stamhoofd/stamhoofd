import { Language } from './Language.js';
import { Organization } from './Organization.js';
import { TranslatedString } from './TranslatedString.js';

export type AppType = 'registration' | 'dashboard' | 'admin' | 'webshop';

/**
 * urls are hardcoded because they need to work without a current language
 */
export function appToTranslatableUri(app: AppType | 'auto'): TranslatedString {
    switch (app) {
        case 'admin':
            return new TranslatedString({
                nl: 'platform',
                en: 'platform',
                fr: 'plateforme',
            });
        case 'dashboard':
            return new TranslatedString({
                nl: 'dashboard',
                en: 'dashboard',
                fr: 'dashboard',
            });
        case 'registration':
            return new TranslatedString({
                nl: 'leden',
                en: 'members',
                fr: 'membres',
            });
        case 'webshop':
            return new TranslatedString({
                nl: 'shop',
                en: 'shop',
                fr: 'shop',
            });
        case 'auto':
            return new TranslatedString({
                nl: 'auto',
                en: 'auto',
                fr: 'auto',
            });
    }
}

export function appToUri(app: AppType | 'auto') {
    return appToTranslatableUri(app).toString();
}

export function uriToApp(uri: string) {
    // Loop all answers of appToTranslatableUri in all languages and return the first match
    for (const app of ['admin', 'dashboard', 'registration', 'auto'] as const) {
        const l = appToTranslatableUri(app);

        if (typeof l.translations === 'string') {
            const translated = appToTranslatableUri(app).toString();
            if (translated && uri === translated) {
                return app;
            }
        }
        else {
            for (const lang in l.translations) {
                const translated = appToTranslatableUri(app).get(lang as Language);
                if (translated && uri === translated) {
                    return app;
                }
            }
        }
    }
    return 'auto';
}

export const getAppName = (app: AppType) => {
    switch (app) {
        case 'dashboard': return $t('d5d2e25f-588e-496e-925f-f7e375c3888a');
        case 'registration': return $t('f02ad9a5-f0b4-483e-961c-491ddf7d6f6a');
        case 'admin': return $t(`6bdca00a-b7ec-413e-b57a-3e192a53564f`);
        case 'webshop': return $t(`e38c0b49-b038-4c9c-9653-fe1e4a078226`);
    }
};

export const getAppTitle = (app: AppType | 'auto', organization: Organization | undefined | null) => {
    if (app === 'auto' || app === 'dashboard') {
        if (!organization) {
            return $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
        }
        return organization.name;
    }
    return getAppName(app);
};

export const getAppDescription = (app: AppType | 'auto', organization: Organization | undefined | null) => {
    if (app === 'auto') {
        if (organization) {
            return organization.address.anonymousString();
        }
        return null;
    }

    if (app === 'dashboard') {
        return getAppName(app);
    }

    if (!organization) {
        switch (app) {
            case 'registration': return $t(`a82ddfb6-f92f-480f-9578-d0cc01a7338e`);
            case 'admin': return $t(`7b374a35-4472-4e2f-aa48-74f42e5e8a41`);
        }
        return null;
    }
    return organization.name;
};
