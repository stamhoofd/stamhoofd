

import { SessionManager } from '../../../../shared/networking'

/**
 * Convenient access to the organization of the current session
 */
export class OrganizationManagerStatic {
    get organization() {
        return SessionManager.currentSession!.organization!
    }
    
}

export const OrganizationManager = new OrganizationManagerStatic()