import { Organization } from "@stamhoofd/structures"
import { inject } from "vue"

export type AppType = 'registration'|'dashboard'|'admin'

export function useAppContext(): AppType {
    return inject('stamhoofd_app', 'dashboard') as AppType
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
        return null;
    }
    if (!organization) {
        switch (app) {
            case 'registration': return 'Mijn inschrijvingen';
            case 'admin': return 'Portaal voor medewerkers'
        }
        return null
    }
    return organization.name
}