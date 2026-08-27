import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, field, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import type { Platform } from '@stamhoofd/structures';
import { Organization, User, Version } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

import { Toast } from '@stamhoofd/components/overlays/Toast';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { isReactive } from 'vue';
import { SessionContext } from './SessionContext';
import { Storage } from './Storage';

class SessionStorage extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];

    @field({ decoder: StringDecoder, nullable: true })
    lastOrganizationId: string | null = null;
}

const MAX_ORGANIZATIONS_STORED = 10;

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

    async getLastSession(platform: Platform) {
        const storage = await this.getSessionStorage(false);
        const id = storage.lastOrganizationId;
        if (id) {
            const session = await this.getContextForOrganization(id, platform);
            if (session && session.canGetCompleted()) {
                return session;
            } else {
                console.log('session can not get completed, no autosignin');
                console.log(session);
            }
        }

        return this.getLastGlobalSession(platform);
    }

    async getLastGlobalSession(platform: Platform) {
        const session = new SessionContext(null, platform);
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
        if (organization.active === false) {
            // Don't add inactive organizations to storage
            return;
        }

        const storage = await this.getSessionStorage(false);
        const index = storage.organizations.findIndex(o => o.id === organization.id);

        if (index !== -1) {
            storage.organizations.splice(index, 1);
        } else {
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
            } catch (e) {
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
                            human: $t(`%kz`),
                        });
                    }
                }

                if (!shouldRetry && Request.isNetworkError(e)) {
                    // Undo setting the session
                    throw new SimpleError({
                        code: 'network_error',
                        message: e.message,
                        human: $t(`%l0`),
                    });
                }

                // still set the current session, but logout that session
                throw e;
            }
        } else {
            // Already complete
            // Initiate a slow background update without retry
            // = we don't need to block the UI for this ;)
            session.updateData(true, false, false, true).catch(async (e) => {
                // Ignore network errors
                console.error('Background fetch session error', e, session);

                if (isSimpleErrors(e) || isSimpleError(e)) {
                    if (e.hasCode('invalid_organization')) {
                        // Clear from session storage
                        if (session.organization) {
                            session.organization.active = false;
                            await this.removeOrganizationFromStorage(session.organization.id).catch(console.error);
                        }
                        const error = new SimpleError({
                            code: 'invalid_organization',
                            message: e.message,
                            human: $t(`%kz`),
                        });
                        Toast.fromError(error).show();
                        session.setLoadingError(error);
                        session.preventComplete = true;
                        return;
                        // window.location.reload();
                    }
                }

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

        session.addListener(this, (changed: 'user' | 'organization' | 'platform' | 'token' | 'preventComplete') => {
            if (changed === 'platform') {
                // Not a session change: the theme manager handles this one. Relaying it here
                // would rewrite the organization storage on every platform refresh.
                return;
            }

            if (session.organization) {
                if (session.loadingError && (isSimpleErrors(session.loadingError) || isSimpleError(session.loadingError)) && (session.loadingError.hasCode('invalid_organization') || session.loadingError.hasCode('archived'))) {
                    this.removeOrganizationFromStorage(session.organization.id).catch(console.error);
                } else {
                    this.addOrganizationToStorage(session.organization).catch(console.error);
                }
            }
            this.callListeners(changed);
        });

        await session.saveToStorage();
        await I18nController.loadDefault({
            $context: session,
            defaultCountry: Country.Belgium,
            defaultLanguage: Language.Dutch,
            country: session?.organization?.address?.country,
        });
        this.saveMissingUserLanguage(session).catch(console.error);
        return session;
    }

    /**
     * Users without a preferred language get the interface language they are using now,
     * so it is reused on other devices and in emails.
     */
    private async saveMissingUserLanguage(session: SessionContext) {
        const user = session.user;
        if (!user || user.language !== null || !session.hasToken()) {
            return;
        }

        const language = I18nController.shared.language;
        await session.authenticatedIdentityServer.request({
            method: 'PATCH',
            path: '/user/' + user.id,
            body: User.patch({ id: user.id, language }),
            decoder: User as Decoder<User>,
            shouldRetry: false,
        });
        await session.updateData(true, false);
    }

    /**
     * Try to create a session, and support offline mode so we don't need to fetch if network is offline
     */
    async getContextForOrganization(id: string, platform: Platform) {
        const sessionStorage = await this.getSessionStorage(false);
        const organization = sessionStorage.organizations.find(o => o.id === id);

        if (organization) {
            const session = new SessionContext(organization, platform);
            await session.loadFromStorage();
            return session;
        }

        const session = await SessionContext.createFrom({ organizationId: id }, platform);
        await session.loadFromStorage();
        return session;
    }

    saveSessionStorage(storage: SessionStorage, retryWithLess = true) {
        try {
            // Limit organization storage length
            storage.organizations.splice(MAX_ORGANIZATIONS_STORED);
            this.cachedStorage = storage;

            // keep this method fast, we don't need to wait because we use cached storage
            Storage.keyValue.setItem('organizations', JSON.stringify(new VersionBox(storage).encode({ version: Version }))).catch(console.error);
        } catch (e) {
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
                } catch (e) {
                    console.error(e);
                }
            }
        } catch (e) {
            console.error(e);
        }
        const cache = SessionStorage.create({});
        this.cachedStorage = cache;
        return cache;
    }

    async availableSessions(platform: Platform): Promise<SessionContext[]> {
        const sessionStorage = await this.getSessionStorage(false);
        const sessions: SessionContext[] = [];

        for (const o of sessionStorage.organizations) {
            const session = new SessionContext(o, platform);
            await session.loadFromStorage();
            sessions.push(session);
        }

        return sessions;
    }

    async getPreparedContextForOrganization(organization: Organization, platform: Platform) {
        if (document.activeElement) {
            // Blur currently focused element, to prevent from opening the login view multiple times
            (document.activeElement as HTMLElement).blur();
        }

        try {
            const session = await this.getContextForOrganization(organization.id, platform);
            session.updateOrganization(organization);
            await this.prepareSessionForUsage(session, false);
            return session;
        } catch (e) {
            if (isSimpleError(e) && e.hasCode('invalid_organization')) {
                // Clear from session storage
                await this.removeOrganizationFromStorage(organization.id);
                throw new SimpleError({
                    code: 'invalid_organization',
                    message: e.message,
                    human: $t(`%kz`),
                });
            }
            throw e;
        }
    }
}

export const SessionManager = new SessionManagerStatic();

(window as any).SessionManager = SessionManager;
