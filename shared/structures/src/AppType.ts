import type { Language } from '@stamhoofd/types/Language';
import type { Address } from './addresses/Address.js';
import type { Organization } from './Organization.js';
import { TranslatedString } from './TranslatedString.js';

export type AppType = 'registration' | 'dashboard' | 'admin' | 'webshop' | 'auto' | 'verify-email';

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
                nl: 'beheerders',
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
        case 'verify-email':
            return new TranslatedString({
                nl: 'verify-email',
                en: 'verify-email',
                fr: 'verify-email',
            });
    }
}

export function appToUri(app: AppType) {
    return appToTranslatableUri(app).toString();
}

export function uriToApp(uri: string) {
    // Loop all answers of appToTranslatableUri in all languages and return the first match
    for (const app of ['admin', 'dashboard', 'registration', 'verify-email', 'auto'] as const) {
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
    return 'auto';
}

export const getAppName = (app: AppType) => {
    switch (app) {
        case 'dashboard': return STAMHOOFD.userMode === 'organization' ? $t('Beheerdersportaal') : $t('%44');
        case 'registration': return $t('%2g');
        case 'admin': return $t(`%IW`);
        case 'webshop': return $t(`%2N`);
    }
    return STAMHOOFD.platformName;
};

export const getAppNameDescription = (app: AppType) => {
    switch (app) {
        case 'dashboard': return $t(`Beheer je eigen vereniging`);
        case 'registration': return $t(`%a5`);
        case 'admin': return $t(`%a6`);
    }
    return null;
};

/**
 * Position where an app is displayed.
 * bar = top bar when currently viewing that option
 * current = switching between apps in the same scope (member portal <-> admin portal of same organization)
 * other = switching between different organizations, or when searching organizations
 */
export type AppDisplayPosition = 'bar' | 'current' | 'other';

export const getAppTitle = (app: AppType | 'auto', organization: Organization | undefined | null, displayPosition: AppDisplayPosition = 'other') => {
    if (displayPosition === 'bar') {
        if (organization) {
            return organization.name;
        }
        return getAppName(app);
    }

    if (displayPosition === 'current' && app !== 'auto') {
        return getAppName(app);
    }

    // Other
    if (!organization) {
        return getAppName(app);
    }
    return organization.name;
};

export const getAppDescription = (app: AppType | 'auto', organization: Organization | undefined | null, displayPosition: AppDisplayPosition = 'other') => {
    if (displayPosition === 'bar') {
        if (organization) {
            return getAppName(app);
        }
        return getAppNameDescription(app);
    }

    if (displayPosition === 'current' && app !== 'auto') {
        return getAppNameDescription(app);
    }

    // Other

    if (!organization) {
        return getAppNameDescription(app);
    }
    return organization.address.anonymousString();
};

export function getAppHost(app: AppType | null, organization: { i18n: { locale: string; language: Language }; address: Address; registerDomain?: string | null; uri: string } | null, preferDashboard = false, i18n?: { language: Language; locale: string }): string {
    if (organization && organization.registerDomain && !preferDashboard && app !== 'admin' && STAMHOOFD.userMode === 'organization') {
        let d = organization.registerDomain;

        if (i18n && i18n.language !== organization.i18n.language) {
            d += '/' + i18n.language;
        }

        if (!app) {
            return d;
        }

        return d + '/' + appToUri(app);
    }

    if (!STAMHOOFD.domains.registration || preferDashboard || !organization) {
        if (!app) {
            return STAMHOOFD.domains.dashboard + '/' + (i18n ?? organization?.i18n ? '/' + (i18n ?? organization!.i18n).locale : '');
        }

        let includeUri = true;
        if (app === 'registration' && STAMHOOFD.userMode === 'platform') {
            // Prefer not to include
            includeUri = false;
        }

        if (app === 'verify-email' && STAMHOOFD.userMode === 'platform') {
            // Users are not scoped
            includeUri = false;
        }

        if (app === 'admin') {
            includeUri = false;
        }

        if (includeUri && !organization) {
            // App requires organization scope, but we don't have one
            return STAMHOOFD.domains.dashboard + (i18n ? '/' + (i18n.locale) : '');
        }

        return STAMHOOFD.domains.dashboard + '/' + (i18n ?? organization?.i18n ? '/' + (i18n ?? organization!.i18n).locale : '') + '/' + appToUri(app) + (includeUri && organization ? '/' + organization.uri : '');
    }

    let defaultDomain = STAMHOOFD.domains.registration[organization.address.country] ?? STAMHOOFD.domains.registration[''];

    if (i18n ?? organization.i18n) {
        defaultDomain += '/' + ((i18n ?? organization.i18n).locale);
    }

    if (!app) {
        return organization.uri + '.' + defaultDomain;
    }

    return organization.uri + '.' + defaultDomain + '/' + appToUri(app);
}
