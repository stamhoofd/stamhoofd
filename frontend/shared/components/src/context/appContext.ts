import type { Organization, AppType, AppDisplayPosition } from '@stamhoofd/structures';
import { getAppName, getAppTitle, getAppDescription } from '@stamhoofd/structures';
import { inject } from 'vue';

export function useAppContext(): AppType | 'auto' {
    return inject('stamhoofd_app', 'dashboard') as AppType | 'auto';
}

export function useAppData() {
    return {
        getAppTitle: (app: AppType | 'auto', organization: Organization | undefined | null, displayPosition: AppDisplayPosition = 'other') => getAppTitle(app, organization, displayPosition),
        getAppDescription: (app: AppType | 'auto', organization: Organization | undefined | null, displayPosition: AppDisplayPosition = 'other') => getAppDescription(app, organization, displayPosition),
        getAppName: (app: AppType) => getAppName(app),
    };
}
