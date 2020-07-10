import { Decoder,ObjectData } from '@simonbackx/simple-encoding';
import { Organization, Version } from '@stamhoofd/structures';

import { Session } from './Session';

/**
 * The SessionManager manages the storage of Sessions for different organizations. You can request the session for a given organization.
 * If a token is present, it will automatically allow the user to be kept logged in.
 * You can also request the available sessions, so you can hint the user in which organizations he is already signed in.
 */
export class SessionManagerStatic {
    currentSession: Session | null = null

    setCurrentSession(session: Session) {
        this.currentSession = session

        // todo: somehow save the session is active and skip selection
        
        // Save organization
    }

    getSessionForOrganization(id: string) {
        for (const session of this.availableSessions()) {
            if (session.organization.id === id) {
                return session
            }
        }
    }

    availableSessions(): Session[] {
        // Loop thru organizations

        const json = localStorage.getItem('organizations')
        if (json) {
            try {
                const parsed = JSON.parse(json)
                const organizations = new ObjectData(parsed, { version: Version }).array(Organization as Decoder<Organization>)

                // Build sessions
                return organizations.map(o => new Session(o))
            } catch (e) {
                console.error(e)
            }
        }
        return []
    }

}

export const SessionManager = new SessionManagerStatic()