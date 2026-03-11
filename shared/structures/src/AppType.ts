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
        case 'dashboard': return $t('%44');
        case 'registration': return $t('%2g');
        case 'admin': return $t(`%IW`);
        case 'webshop': return $t(`%2N`);
    }
};

export const getAppTitle = (app: AppType | 'auto', organization: Organization | undefined | null) => {
    if (app === 'auto' || app === 'dashboard') {
        if (!organization) {
            return $t(`%Gr`);
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
            case 'registration': return $t(`%a5`);
            case 'admin': return $t(`%a6`);
        }
        return null;
    }
    return organization.name;
};
