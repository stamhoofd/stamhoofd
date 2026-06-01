import type { Language } from '@stamhoofd/types/Language';
import type { Organization } from './Organization.js';
import { TranslatedString } from './TranslatedString.js';

const ALL_APPS = ['registration', 'dashboard', 'admin', 'webshop', 'auto-switcher', 'organization-selector', 'auth'] as const;
export type AppType = typeof ALL_APPS[number];

/**
 * urls are hardcoded because they need to work without a current language
 */
export function appToTranslatableUri(app: AppType): TranslatedString {
    switch (app) {
        case 'admin':
            return new TranslatedString({
                nl: 'platform',
                en: 'platform',
                fr: 'plateforme',
            });
        case 'dashboard':
            return new TranslatedString({
                nl: 'dashboard', // in toekomst is 'beheerders' mss beter
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
        case 'auto-switcher':
            return new TranslatedString({
                nl: 'auto',
                en: 'auto',
                fr: 'auto',
            });
        case 'organization-selector':
            return new TranslatedString({
                nl: 'verenigingen',
                en: 'organizations',
                fr: 'organisations',
            });
        case 'auth':
            return new TranslatedString({
                nl: 'login',
                en: 'login',
                fr: 'login',
            });
    }
}

export function appToUri(app: AppType) {
    return appToTranslatableUri(app).toString();
}

export function uriToApp(uri: string): AppType | null {
    // Loop all answers of appToTranslatableUri in all languages and return the first match
    for (const app of ALL_APPS) {
        const l = appToTranslatableUri(app);

        if (typeof l.translations === 'string') {
            const translated = appToTranslatableUri(app).toString();
            if (translated && uri === translated) {
                return app;
            }
        } else {
            for (const lang in l.translations) {
                const translated = appToTranslatableUri(app).get(lang as Language);
                if (translated && uri === translated) {
                    return app;
                }
            }
        }
    }
    return null;
}

export const getAppName = (app: AppType) => {
    switch (app) {
        case 'dashboard': return $t('%44');
        case 'registration': return $t('%2g');
        case 'admin': return $t(`%IW`);
        case 'webshop': return $t(`%2N`);
        case 'auto-switcher': return $t(`%Gr`);
        case 'organization-selector': return $t(`%Gr`);
        case 'auth': return $t(`Login`);
    }
};

export const getAppTitle = (app: AppType, organization: Organization | undefined | null) => {
    if (app === 'auto-switcher' || app === 'dashboard') {
        if (!organization) {
            return $t(`%Gr`);
        }
        return organization.name;
    }
    return getAppName(app);
};

export const getAppDescription = (app: AppType, organization: Organization | undefined | null) => {
    if (app === 'auto-switcher') {
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
