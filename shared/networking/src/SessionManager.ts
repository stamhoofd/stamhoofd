import { ArrayDecoder,AutoEncoder, Decoder,field, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { Organization, Version } from '@stamhoofd/structures';

import { Session } from './Session';

class SessionStorage extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Organization)})
    organizations: Organization[] = []
    
    @field({ decoder: StringDecoder, nullable: true })
    lastOrganizationId: string | null = null
}

type AuthenticationStateListener = () => void

/**
 * The SessionManager manages the storage of Sessions for different organizations. You can request the session for a given organization.
 * If a token is present, it will automatically allow the user to be kept logged in.
 * You can also request the available sessions, so you can hint the user in which organizations he is already signed in.
 */
export class SessionManagerStatic {
    currentSession: Session | null = null

    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    constructor() {
        const id = this.getSessionStorage().lastOrganizationId
        if (id) {
            const session = this.getSessionForOrganization(id)
            if (session && session.canGetCompleted()) {
                this.setCurrentSession(session)
            } else {
                console.log("session can not get completed, no autosignin")
                console.log(session)
            }
        }
    }

    addListener(owner: any, listener: AuthenticationStateListener) {
        this.listeners.set(owner, listener)
    }

    removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    protected callListeners() {
        for (const listener of this.listeners.values()) {
            listener()
        }
    }

    deactivateSession() {
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = null

        const storage = this.getSessionStorage()
        storage.lastOrganizationId = null
        this.saveSessionStorage(storage)
        this.callListeners()
    }

    addOrganizationToStorage(organization: Organization) {
        const storage = this.getSessionStorage()
        const index = storage.organizations.map(o => o.id).indexOf(organization.id)

        // todo: improve this a lot
        if (index !== -1) {
            storage.organizations.splice(index, 1)
        }
        storage.organizations.unshift(organization)
        this.saveSessionStorage(storage)
    }

    setCurrentSession(session: Session) {
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = session

        const storage = this.getSessionStorage()
        storage.lastOrganizationId = session.organizationId
        this.saveSessionStorage(storage)

        let needsResync = !session.organization
        if (session.organization) {
            this.addOrganizationToStorage(session.organization)
        }

        this.callListeners()

        this.currentSession.addListener(this, () => {
            if (needsResync && session.organization) {
                needsResync = false
                this.addOrganizationToStorage(session.organization)
            }
            this.callListeners()
        })

        this.currentSession.updateData()
    }

    getSessionForOrganization(id: string) {
        for (const session of this.availableSessions()) {
            if (session.organizationId === id) {
                return session
            }
        }
    }

    saveSessionStorage(storage: SessionStorage) {
        localStorage.setItem('organizations', JSON.stringify(storage.encode({ version: Version })))
    }

    getSessionStorage(): SessionStorage {
        // Loop thru organizations

        const json = localStorage.getItem('organizations')
        if (json) {
            try {
                const parsed = JSON.parse(json)
                return new ObjectData(parsed, { version: Version }).decode(SessionStorage as Decoder<SessionStorage>)
            } catch (e) {
                console.error(e)
            }
        }
        return SessionStorage.create({})
    }

    availableSessions(): Session[] {
        return this.getSessionStorage().organizations.map(o => {
            const session = new Session(o.id)
            session.setOrganization(o)

            return session
        })
    }

}

export const SessionManager = new SessionManagerStatic();

(window as any).SessionManager = SessionManager