import { SessionManager } from '@stamhoofd/networking'

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManagerStatic {
    get organization() {
        return SessionManager.currentSession!.organization!
    }

    async reloadGroups() {
        await SessionManager.currentSession!.fetchOrganization()
    }
}

export const OrganizationManager = new OrganizationManagerStatic()