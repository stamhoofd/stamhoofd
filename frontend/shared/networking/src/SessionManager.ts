import { ArrayDecoder, AutoEncoder, Decoder, field, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { Country, Language, Organization, Version } from '@stamhoofd/structures';

import { SessionContext } from './SessionContext';
import { Storage } from './Storage';
import { isReactive } from 'vue';
import { I18nController } from '@stamhoofd/frontend-i18n';

class SessionStorage extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];

    @field({ decoder: StringDecoder, nullable: true })
    lastOrganizationId: string | null = null;
}

type AuthenticationStateListener = (changed: 'preventComplete' | 'user' | 'organization' | 'token' | 'session') => void;

/**
 * The SessionManager manages the storage of Sessions for different organizations. You can request the session for a given organization.
 * If a token is present, it will automatically allow the user to be kept logged in.
 * You can also request the available sessions, so you can hint the user in which organizations he is already signed in.
 */
export class SessionManagerStatic {
    // currentSession: SessionContext | null = null

    protected cachedStorage?: SessionStorage;
    protected listeners: Map<any, AuthenticationStateListener> = new Map();

    async getLastSession() {
        const storage = await this.getSessionStorage(false);
        const id = storage.lastOrganizationId;
        if (id) {
            const session = await this.getContextForOrganization(id);
            if (session && session.canGetCompleted()) {
                return session;
            }
            else {
                console.log('session can not get completed, no autosignin');
                console.log(session);
            }
        }

        return this.getLastGlobalSession();
    }

    async getLastGlobalSession() {
        const session = new SessionContext(null);
        await session.loadFromStorage();
        return session;
    }

    addListener(owner: any, listener: AuthenticationStateListener) {
        this.listeners.set(owner, listener);
    }

    removeListener(owner: any) {
        this.listeners.delete(owner);
    }

    protected callListeners(changed: 'user' | 'organization' | 'token' | 'session' | 'preventComplete') {
        for (const listener of this.listeners.values()) {
            listener(changed);
        }
    }

    async addOrganizationToStorage(organization: Organization, options: { updateOnly?: boolean } = {}) {
        const storage = await this.getSessionStorage(false);
        const index = storage.organizations.findIndex(o => o.id === organization.id);

        if (index !== -1) {
            storage.organizations.splice(index, 1);
        }
        else {
            if (options.updateOnly) {
                return;
            }
        }
        storage.organizations.unshift(organization);
        this.saveSessionStorage(storage);
    }

    async removeOrganizationFromStorage(organizationId: string) {
        const storage = await this.getSessionStorage(false);
        const index = storage.organizations.map(o => o.id).indexOf(organizationId);

        // TODO: improve this a lot
        if (index !== -1) {
            storage.organizations.splice(index, 1);
        }
        this.saveSessionStorage(storage);
    }

    async prepareSessionForUsage(session: SessionContext, shouldRetry = true) {
        console.log('prepareSessionForUsage');
        session.enableStorage();

        if (!isReactive(session)) {
            console.error('Passing around a non-reactive session can cause issues. Prevent using a session that is not reactive.');
        }

        // WARNING: currently there is a bug that for the first session is loaded before
        // the platform is loaded
        // -> responsibilities not loaded
        // -> thinks you don't have permission for the current organization
        // -> the session is complete because privateMeta is not a requirement
        // -> later, the platform is loaded
        // -> suddenly you have permissions and the session is no longer considered complete
        if (session.canGetCompleted() && !session.isComplete()) {
            // Always request a new user (the organization is not needed)
            // session.user = null
            if (!session.user) {
                console.log('Doing a sync session update because user is missing');
            }

            if (session.preventComplete) {
                console.log('Doing a sync session update because preventComplete');
            }

            if (session.user && !session.preventComplete) {
                console.log('Doing a sync session update other');
            }

            try {
                await session.updateData(true, shouldRetry, true);
            }
            catch (e) {
                console.error('Failed to update data in preparation of session', e);

                if (isSimpleErrors(e) || isSimpleError(e)) {
                    if (e.hasCode('invalid_organization')) {
                        // Clear from session storage
                        if (session.organization) {
                            await this.removeOrganizationFromStorage(session.organization.id);
                        }
                        throw new SimpleError({
                            code: 'invalid_organization',
                            message: e.message,
                            human: $t(`67221175-c027-47be-bb1b-2a535cb9fc5f`),
                        });
                    }
                }

                if (!shouldRetry && Request.isNetworkError(e)) {
                    // Undo setting the session
                    throw new SimpleError({
                        code: 'network_error',
                        message: e.message,
                        human: $t(`a76c1371-da18-4998-970d-ec4f443d5664`),
                    });
                }

                // still set the current session, but logout that session
                throw e;
            }
        }
        else {
            // Already complete
            // Initiate a slow background update without retry
            // = we don't need to block the UI for this ;)
            session.updateData(true, false, false, true).catch((e) => {
                // Ignore network errors
                console.error('Background fetch session error', e, session);
                session.callListeners('preventComplete');

                if (!session.isComplete()) {
                    session.setLoadingError(e);
                }
            });
        }

        const storage = await this.getSessionStorage(false);
        storage.lastOrganizationId = session.organization?.id ?? null;
        this.saveSessionStorage(storage);

        if (session.organization) {
            this.addOrganizationToStorage(session.organization).catch(console.error);
        }

        this.callListeners('session');

        session.addListener(this, (changed: 'user' | 'organization' | 'token' | 'preventComplete') => {
            if (session.organization) {
                this.addOrganizationToStorage(session.organization).catch(console.error);
            }
            this.callListeners(changed);
        });

        await session.saveToStorage();
        await I18nController.loadDefault(session, Country.Belgium, Language.Dutch, session?.organization?.address?.country);
        return session;
    }

    /**
     * Try to create a session, and support offline mode so we don't need to fetch if network is offline
     */
    async getContextForOrganization(id: string) {
        const sessionStorage = await this.getSessionStorage(false);
        const organization = sessionStorage.organizations.find(o => o.id === id);

        if (organization) {
            const session = new SessionContext(organization);
            await session.loadFromStorage();
            return session;
        }

        const session = await SessionContext.createFrom({ organizationId: id });
        await session.loadFromStorage();
        return session;
    }

    saveSessionStorage(storage: SessionStorage, retryWithLess = true) {
        try {
            this.cachedStorage = storage;

            // keep this method fast, we don't need to wait because we use cached storage
            Storage.keyValue.setItem('organizations', JSON.stringify(new VersionBox(storage).encode({ version: Version }))).catch(console.error);
        }
        catch (e) {
            console.error(e);

            // Possible out of storage: delete one organization and try again
            if (retryWithLess && storage.organizations.length > 1) {
                storage.organizations.pop();
                this.saveSessionStorage(storage, false);
            }
        }
    }

    async getSessionStorage(allowCache = true): Promise<SessionStorage> {
        if (this.cachedStorage && allowCache) {
            return this.cachedStorage;
        }
        // Loop through organizations
        try {
            const json = await Storage.keyValue.getItem('organizations');
            if (json) {
                try {
                    const parsed = JSON.parse(json);
                    const cache = new ObjectData(parsed, { version: Version }).decode(new VersionBoxDecoder(SessionStorage as Decoder<SessionStorage>)).data;
                    this.cachedStorage = cache;
                    return cache;
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
        const cache = SessionStorage.create({});
        this.cachedStorage = cache;
        return cache;
    }

    async availableSessions(): Promise<SessionContext[]> {
        const sessionStorage = await this.getSessionStorage(false);
        const sessions: SessionContext[] = [];

        for (const o of sessionStorage.organizations) {
            const session = new SessionContext(o);
            await session.loadFromStorage();
            sessions.push(session);
        }

        return sessions;
    }

    async getPreparedContextForOrganization(organization: Organization) {
        if (document.activeElement) {
            // Blur currently focused element, to prevent from opening the login view multiple times
            (document.activeElement as HTMLElement).blur();
        }

        try {
            const session = await this.getContextForOrganization(organization.id);
            session.setOrganization(organization);
            await this.prepareSessionForUsage(session, false);
            return session;
        }
        catch (e) {
            if (isSimpleError(e) && e.hasCode('invalid_organization')) {
                // Clear from session storage
                await this.removeOrganizationFromStorage(organization.id);
                throw new SimpleError({
                    code: 'invalid_organization',
                    message: e.message,
                    human: $t(`67221175-c027-47be-bb1b-2a535cb9fc5f`),
                });
            }
            throw e;
        }
    }
}

export const SessionManager = new SessionManagerStatic();

(window as any).SessionManager = SessionManager;
