import * as Sentry from '@sentry/browser';
import { ArrayDecoder, AutoEncoder, Decoder, field, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Organization, Version } from '@stamhoofd/structures';

import { Keychain } from './Keychain';
import { Session } from './Session';
import { Storage } from './Storage';

class SessionStorage extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = []

    @field({ decoder: StringDecoder, nullable: true })
    lastOrganizationId: string | null = null
}

type AuthenticationStateListener = (changed: "userPrivateKey" | "user" | "organization" | "token" | "session") => void

/**
 * The SessionManager manages the storage of Sessions for different organizations. You can request the session for a given organization.
 * If a token is present, it will automatically allow the user to be kept logged in.
 * You can also request the available sessions, so you can hint the user in which organizations he is already signed in.
 */
export class SessionManagerStatic {
    currentSession: Session | null = null

    protected cachedStorage?: SessionStorage
    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    async restoreLastSession() {
        // Restore keychain before setting the current session
        // to prevent fetching the organization to refetch the missing keychain items
        await Keychain.load()

        const id = (await this.getSessionStorage()).lastOrganizationId
        if (id) {
            const session = await this.getSessionForOrganization(id)
            if (session && session.canGetCompleted()) {
                
                await this.setCurrentSession(session)
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

    protected callListeners(changed: "userPrivateKey" | "user" | "organization" | "token" | "session") {
        for (const listener of this.listeners.values()) {
            listener(changed)
        }
    }

    deactivateSession() {
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = null;
        this.callListeners("session");

        // Not important async block: we don't need to wait for a save here
        (async () => {
            const storage = await this.getSessionStorage()
            storage.lastOrganizationId = null
            this.saveSessionStorage(storage)
        })().catch(console.error)
    }

    async addOrganizationToStorage(organization: Organization) {
        const storage = await this.getSessionStorage()
        const index = storage.organizations.map(o => o.id).indexOf(organization.id)

        // todo: improve this a lot
        if (index !== -1) {
            storage.organizations.splice(index, 1)
        }
        storage.organizations.unshift(organization)
        this.saveSessionStorage(storage)
    }

    async removeOrganizationFromStorage(organizationId: string) {
        const storage = await this.getSessionStorage()
        const index = storage.organizations.map(o => o.id).indexOf(organizationId)

        // todo: improve this a lot
        if (index !== -1) {
            storage.organizations.splice(index, 1)
        }
        this.saveSessionStorage(storage)
    }

    logout() {
        if (this.currentSession) {
            this.currentSession.logout()
        }
        this.clearCurrentSession()
    }

    clearCurrentSession() {
        console.error("Clear current session")
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = null
        this.callListeners("session")
    }

    /**
     * 
     * @param session 
     * @param shouldRetry If you set this to false, setting the session might fail, so make sure to catch this
     */
    async setCurrentSession(session: Session, shouldRetry = true) {
        console.log("Changing current session")
        if (this.currentSession) {
            this.currentSession.removeListener(this)
        }
        this.currentSession = session

        if (session.canGetCompleted() && !session.isComplete()) {
            // Always request a new user (the organization is not needed)
            // session.user = null
            if (!session.organization) {
                console.log("Doing a sync session update because organization is missing")
            }
            if (!session.user) {
                console.log("Doing a sync session update because user is missing")
            }

            if (session.preventComplete) {
                console.log("Doing a sync session update because preventComplete")
            }

            if (session.organization && session.user && !session.preventComplete) {
                console.log("Doing a sync session update other")
            }

            try {
                await session.updateData(false, shouldRetry, true)
            } catch (e) {
                if (isSimpleErrors(e) || isSimpleError(e)) {
                    if (e.hasCode("invalid_organization")) {
                        // Clear from session storage
                        await this.removeOrganizationFromStorage(session.organizationId)
                        this.logout()
                        throw new SimpleError({
                            code: "invalid_organization",
                            message: e.message,
                            human: "Deze vereniging bestaat niet (meer)"
                        })
                    }
                }

                if (!shouldRetry && Request.isNetworkError(e)) {
                    // Undo setting the session
                    this.clearCurrentSession()
                    throw new SimpleError({
                        code: "network_error",
                        message: e.message,
                        human: "We konden geen verbinding maken met internet. Kijk jouw internetverbinding na en probeer opnieuw."
                    })
                }

                // still set the current session, but logout that session
                session.temporaryLogout()
            }
        } else {
            if (session.canGetCompleted()) {
                // Initiate a slow background update without retry
                // = we don't need to block the UI for this ;)
                session.updateData(true, false).catch(e => {
                    // Ignore network errors
                    console.error(e)
                })
            }
        }

        const storage = await this.getSessionStorage()
        storage.lastOrganizationId = session.organizationId
        this.saveSessionStorage(storage)

        const needsResync = true
        if (session.organization) {
            this.addOrganizationToStorage(session.organization).catch(console.error)
        }

        this.callListeners("session")

        this.currentSession.addListener(this, (changed: "userPrivateKey" | "user" | "organization" | "token") => {
            if (needsResync && session.organization) {
                //needsResync = false
                this.addOrganizationToStorage(session.organization).catch(console.error)
            }
            this.setUserId();
            this.callListeners(changed)
        })

        this.setUserId();
    }

    setUserId() {
        if (this.currentSession && this.currentSession.user) {
            const id = this.currentSession.user.id;
            Sentry.configureScope(function(scope) {
                scope.setUser({"id": id});
            });
        }
    }

    async getSessionForOrganization(id: string) {
        if (this.currentSession && this.currentSession.organizationId == id) {
            return this.currentSession
        }
        for (const session of await this.availableSessions()) {
            if (session.organizationId === id) {
                return session
            }
        }
    }

    saveSessionStorage(storage: SessionStorage) {
        try {
            this.cachedStorage = storage

            // keep this method fast, we don't need to wait because we use cached storage
            Storage.keyValue.setItem('organizations', JSON.stringify(new VersionBox(storage).encode({ version: Version }))).catch(console.error)
        } catch (e) {
            console.error(e)
        }
    }

    async getSessionStorage(): Promise<SessionStorage> {
        if (this.cachedStorage) {
            return this.cachedStorage
        }
        // Loop thru organizations
        try {
            const json = await Storage.keyValue.getItem('organizations')
            if (json) {
                try {
                    const parsed = JSON.parse(json)
                    const cache = new ObjectData(parsed, { version: Version }).decode(new VersionBoxDecoder(SessionStorage as Decoder<SessionStorage>)).data
                    this.cachedStorage = cache
                    return cache
                } catch (e) {
                    console.error(e)
                }
            }
        } catch (e) {
            console.error(e)
        }
        const cache = SessionStorage.create({})
        this.cachedStorage = cache
        return cache
    }

    async availableSessions(): Promise<Session[]> {
        const sessionStorage = await this.getSessionStorage()
        const sessions: Session[] = []

        for (const o of sessionStorage.organizations) {
            const session = new Session(o.id)
            session.setOrganization(o)
            await session.loadFromStorage()
            sessions.push(session)
        }

        return sessions
    }
}

export const SessionManager = new SessionManagerStatic();

(window as any).SessionManager = SessionManager