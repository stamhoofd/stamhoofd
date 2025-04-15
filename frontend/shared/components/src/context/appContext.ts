import { I18nController, useTranslate } from '@stamhoofd/frontend-i18n';
import { Organization } from '@stamhoofd/structures';
import { inject } from 'vue';

export type AppType = 'registration' | 'dashboard' | 'admin' | 'webshop';

export function useAppContext(): AppType | 'auto' {
    return inject('stamhoofd_app', 'dashboard') as AppType | 'auto';
}

export const getAppName = (app: AppType, $t: ReturnType<typeof useTranslate>) => {
    switch (app) {
        case 'dashboard': return $t('d5d2e25f-588e-496e-925f-f7e375c3888a');
        case 'registration': return $t('f02ad9a5-f0b4-483e-961c-491ddf7d6f6a');
        case 'admin': return $t(`Administratieportaal`);
        case 'webshop': return $t(`Webshop`);
    }
};

export function useAppData() {
    const $t = useTranslate();

    return {
        getAppTitle: (app: AppType | 'auto', organization: Organization | undefined | null) => getAppTitle(app, organization, $t),
        getAppDescription: (app: AppType | 'auto', organization: Organization | undefined | null) => getAppDescription(app, organization, $t),
        getAppName: (app: AppType) => getAppName(app, $t),
    };
}

export const getAppTitle = (app: AppType | 'auto', organization: Organization | undefined | null, $t: ReturnType<typeof useTranslate>) => {
    if (app === 'auto' || app === 'dashboard') {
        if (!organization) {
            return $t(`Onbekend`);
        }
        return organization.name;
    }
    return getAppName(app, $t);
};

export const getAppDescription = (app: AppType | 'auto', organization: Organization | undefined | null, $t: ReturnType<typeof useTranslate>) => {
    if (app === 'auto') {
        if (organization) {
            return organization.address.anonymousString(I18nController.shared.countryCode);
        }
        return null;
    }

    if (app === 'dashboard') {
        return getAppName(app, $t);
    }

    if (!organization) {
        switch (app) {
            case 'registration': return $t(`Jouw gegevens en inschrijvingen`);
            case 'admin': return $t(`Portaal voor beroepskrachten`);
        }
        return null;
    }
    return organization.name;
};
