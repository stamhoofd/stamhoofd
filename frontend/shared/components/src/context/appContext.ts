import { Organization, getAppName, getAppTitle, getAppDescription, AppType } from '@stamhoofd/structures';
import { inject } from 'vue';

export function useAppContext(): AppType | 'auto' {
    return inject('stamhoofd_app', 'dashboard') as AppType | 'auto';
}

export function useAppData() {
    return {
        getAppTitle: (app: AppType | 'auto', organization: Organization | undefined | null) => getAppTitle(app, organization),
        getAppDescription: (app: AppType | 'auto', organization: Organization | undefined | null) => getAppDescription(app, organization),
        getAppName: (app: AppType) => getAppName(app),
    };
}
