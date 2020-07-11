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

    setCurrentSession(session: Session) {
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = session

        const storage = this.getSessionStorage()
        storage.lastOrganizationId = session.organization.id
        const index = storage.organizations.map(o => o.id).indexOf(session.organization.id)

        if (index !== -1) {
            storage.organizations.splice(index, 1)
        }
        storage.organizations.unshift(session.organization)
        this.saveSessionStorage(storage)

        this.callListeners()

        this.currentSession.addListener(this, () => {
            this.callListeners()
        })

        this.currentSession.updateData()
    }

    getSessionForOrganization(id: string) {
        for (const session of this.availableSessions()) {
            if (session.organization.id === id) {
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
        return this.getSessionStorage().organizations.map(o => new Session(o))
    }

}

export const SessionManager = new SessionManagerStatic();

(window as any).SessionManager = SessionManager