import { I18nController } from "@stamhoofd/frontend-i18n"
import { Organization } from "@stamhoofd/structures"
import { inject } from "vue"

export type AppType = 'registration'|'dashboard'|'admin'

export function useAppContext(): AppType|'auto' {
    return inject('stamhoofd_app', 'dashboard') as AppType|'auto'
}

export const getAppName = (app: AppType) => {
    switch (app) {
        case 'dashboard': return 'Beheerdersportaal';
        case 'registration': return 'Ledenportaal';
        case 'admin': return 'Administratieportaal'
    }
}

export const getAppTitle = (app: AppType|'auto', organization: Organization|undefined|null) => {
    if (app === 'auto') {
        if (!organization) {
            return 'Onbekend'
        }
        return organization.name
    }
    return getAppName(app)
}

export const getAppDescription = (app: AppType|'auto', organization: Organization|undefined|null) => {
    if (app === 'auto') {
        if (organization) {
            return organization.address.anonymousString(I18nController.shared.country)
        }
        return null;
    }
    if (!organization) {
        switch (app) {
            case 'registration': return 'Schrijf je in bij een lokale groep';
            case 'admin': return 'Portaal voor beroepskrachten'
        }
        return null
    }
    return organization.name
}
