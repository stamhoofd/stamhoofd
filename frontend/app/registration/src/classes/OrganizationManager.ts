import { SessionManager } from '@stamhoofd/networking'
import { Organization } from '@stamhoofd/structures'

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManagerStatic {
    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get optionalOrganization(): Organization | undefined {
        return SessionManager.currentSession?.organization ?? undefined
    }

    async reloadGroups() {
        await SessionManager.currentSession!.fetchOrganization()
    }
}

export const OrganizationManager = new OrganizationManagerStatic()