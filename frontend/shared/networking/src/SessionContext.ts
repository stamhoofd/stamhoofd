import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request, RequestMiddleware } from '@simonbackx/simple-networking';
import { Toast } from '@stamhoofd/components';
import { LoginProviderType, OpenIDAuthTokenResponse, Organization, Platform, Token, UserWithMembers, Version } from '@stamhoofd/structures';
import { isReactive, reactive } from 'vue';

import { SessionManager, UrlHelper } from '..';
import { ContextPermissions } from './ContextPermissions';
import { ManagedToken } from './ManagedToken';
import { NetworkManager } from './NetworkManager';
import { Storage } from './Storage';
import { QueueHandler } from './QueueHandler';

type AuthenticationStateListener = (changed: 'user' | 'organization' | 'token' | 'preventComplete') => void;

// dec2hex :: Integer -> String
// i.e. 0-255 -> '00'-'ff'
function dec2hex(dec) {
    return dec.toString(16).padStart(2, '0');
}

// generateId :: Integer -> String
function generateId(len) {
    const arr = new Uint8Array((len || 40) / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
}

export class SessionContext implements RequestMiddleware {
    /**
     * This will become optional in the future
     */
    organization: Organization | null = null;
    user: UserWithMembers | null = null;
    loadingError: Error | null = null;

    /**
     * Manually mark the session as incomplete by setting this to true
     * Not using #private syntax because that messes with Vue proxies
    */
    _preventComplete = false;

    protected token: ManagedToken | null = null;
    protected usedPlatformStorage = false;

    // Stored: encryption key to obtain the private keys (valid token needed in order to have any meaning => revokable in case of leakage, lost device, theft)
    // Storage is required since otherwise you would have to enter your password again every time you reload the page
    // protected authEncryptionKey: string | null = null

    // We can store the private key in the browser, because on password change it will get changed
    // protected userPrivateKey: string | null = null // Used to decrypt messages for this user

    protected listeners: Map<any, AuthenticationStateListener> = new Map();

    isStorageDisabled = false;

    constructor(organization: Organization | null) {
        this.organization = organization;
        this.usedPlatformStorage = this.organization === null;

        // Reactive hack: always force creating reactive SessionContext
        return reactive(this) as unknown as SessionContext;
    }

    disableStorage() {
        this.isStorageDisabled = true;
    }

    enableStorage() {
        this.isStorageDisabled = false;
        this.saveToStorage().catch(console.error);
    }

    /**
     * @deprecated
     */
    get organizationId() {
        return this.organization?.id ?? null;
    }

    /**
     * @deprecated
     * Use auth.permissions
     */
    get organizationPermissions() {
        if (!this.organization) {
            return null;
        }
        return this.user?.permissions?.forOrganization(this.organization, Platform.shared) ?? null;
    }

    /**
     * @deprecated
     * Use auth
     */
    get organizationAuth() {
        return this.auth;
    }

    _auth: ContextPermissions | null = null;
    get auth() {
        if (!this._auth) {
            this._auth = new ContextPermissions(this.user, this.organization, Platform.shared);
        }
        return this._auth;
    }

    clearAuthCache() {
        this._auth = null;
    }

    static async createFrom(data: ({ organization: Organization } | { organizationId: string })) {
        let organization: Organization;
        if ('organizationId' in data) {
            // If we have the token, we better do an authenticated request
            const response = await SessionContext.serverForOrganization(data.organizationId).request({
                method: 'GET',
                path: '/organization',
                decoder: Organization as Decoder<Organization>,
                shouldRetry: false,
            });
            organization = response.data;
        }
        else {
            organization = data.organization;
        }

        return new SessionContext(organization);
    }

    get preventComplete() {
        return this._preventComplete;
    }

    set preventComplete(preventComplete: boolean) {
        this._preventComplete = preventComplete;
        this.callListeners('preventComplete');
    }

    async loadTokenFromStorage() {
        if (this.isStorageDisabled) {
            return;
        }

        if (this.token && this.token.isRefreshing()) {
            console.error('[SessionContext] Loading token from storage while current token is refreshing - something is wrong with timing and locking');
        }

        console.log('[SessionContext] Loading Token from Storage');

        // Check localstorage
        try {
            let usePlatformStorage = !this.organization || STAMHOOFD.userMode === 'platform';
            const json = await Storage.secure.getItem('token-' + (!usePlatformStorage ? this.organization!.id : 'platform'));
            if (json) {
                try {
                    const parsed = JSON.parse(json);
                    const token = Token.decode(new ObjectData(parsed, { version: Version }));
                    this.setTokenWithoutSaving(token, usePlatformStorage);
                    return;
                }
                catch (e) {
                    console.error(e);
                }
            }

            if (!usePlatformStorage) {
                usePlatformStorage = true;
                // Also try platform token
                const json2 = await Storage.secure.getItem('token-' + 'platform');
                if (json2) {
                    try {
                        const parsed = JSON.parse(json2);
                        const token = Token.decode(new ObjectData(parsed, { version: Version }));
                        this.setTokenWithoutSaving(token, usePlatformStorage);
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        catch (e) {
            console.error('Localstorage error');
            console.error(e);
        }
    }

    async loadFromStorage() {
        await QueueHandler.schedule('session-context-token', async () => {
            if (this.isStorageDisabled) {
                return;
            }

            // Check localstorage
            try {
                await this.loadTokenFromStorage();

                if (this.token) {
                    // Also check if we have the user (optional)
                    const json = await Storage.secure.getItem('user-' + (!this.usedPlatformStorage ? this.organization!.id : 'platform'));
                    if (json) {
                        try {
                            const parsed = JSON.parse(json);
                            this.user = new ObjectData(parsed, { version: 0 }).decode(new VersionBoxDecoder(UserWithMembers as Decoder<UserWithMembers>) as Decoder<VersionBox<UserWithMembers>>).data;
                            this.clearAuthCache();
                            this.callListeners('user');
                            return;
                        }
                        catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
            catch (e) {
                console.error('Localstorage error');
                console.error(e);
            }
        });
    }

    private async doSaveToStorage() {
        if (this.isStorageDisabled) {
            return;
        }

        try {
            // Save token to localStorage
            if (this.token) {
                const suffix = (this.user
                    ? (this.user.organizationId ? this.user.organizationId : 'platform')
                    : (
                            this.usedPlatformStorage ? 'platform' : (this.organization!.id)
                        ));

                if (suffix == 'platform' && this.organization) {
                    await Storage.secure.removeItem('token-' + this.organization.id);
                    await Storage.secure.removeItem('user-' + this.organization.id);
                }

                if (suffix !== 'platform') {
                    await Storage.secure.removeItem('token-platform');
                    await Storage.secure.removeItem('user-platform');
                }

                await Storage.secure.setItem('token-' + suffix, JSON.stringify(this.token.token.encode({ version: Version })));

                if (this.user) {
                    await Storage.secure.setItem('user-' + suffix, JSON.stringify(new VersionBox(this.user).encode({ version: Version })));
                }
                else {
                    await Storage.secure.removeItem('user-' + suffix);
                }

                console.log('[SessionContext] Saved token to storage, suffix: ' + suffix);
            }
        }
        catch (e) {
            console.error('Storage error when saving session');
            console.error(e);
        }
    }

    async saveToStorage() {
        await QueueHandler.schedule('session-context-token', async () => {
            await this.doSaveToStorage();
        });
    }

    private async deleteFromStorage() {
        if (this.isStorageDisabled) {
            return;
        }

        try {
            if (this.organization) {
                await Storage.secure.removeItem('token-' + this.organization.id);
                await Storage.secure.removeItem('user-' + this.organization.id);
            }
            if (this.usedPlatformStorage || STAMHOOFD.userMode === 'platform') {
                await Storage.secure.removeItem('token-platform');
                await Storage.secure.removeItem('user-platform');
            }
        }
        catch (e) {
            console.error('Storage error when saving session');
            console.error(e);
        }

        console.log('Deleted token to storage');
    }

    removeFromStorage() {
        if (this.isStorageDisabled) {
            return;
        }
        try {
            void Storage.secure.removeItem('token-' + this.organizationId);
            void Storage.secure.removeItem('user-' + this.organizationId);

            // Deprecated: but best to delete it for now
            void Storage.secure.removeItem('key-' + this.organizationId);
        }
        catch (e) {
            console.error('Storage error when deleting session');
            console.error(e);
        }

        console.log('Deleted token to storage');
    }

    async checkSSO() {
        const search = UrlHelper.initial.getSearchParams();
        const oid_rt = search.get('oid_rt');
        const state = search.get('s');
        const error = search.get('error');
        const msg = search.get('msg');

        console.log('Checking SSO', oid_rt, state, error);

        if (oid_rt && state) {
            // Delete initial url
            search.delete('oid_rt');
            search.delete('s');

            // Check valid state
            try {
                const savedState = await Storage.secure.getItem('oid-state');
                if (savedState !== state) {
                    console.warn('SSO state didn\'t match');

                    if (!this.canGetCompleted()) {
                        new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show();
                    }
                    return;
                }
                Storage.secure.removeItem('oid-state').catch(console.error);
            }
            catch (e) {
                console.error(e);

                if (!this.canGetCompleted()) {
                    new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show();
                }
                return;
            }

            await this.setToken(new Token({
                accessToken: '',
                refreshToken: oid_rt,
                accessTokenValidUntil: new Date(0),
            }));

            try {
                // We successfull logged in, so clear the tried login - will make sure we'll log in automatically next time
                sessionStorage.removeItem('triedLogin');
            }
            catch (e) {
                console.error(e);
            }
        }

        if (state && error) {
            search.delete('error');
            search.delete('s');

            // Check valid state
            try {
                const savedState = await Storage.secure.getItem('oid-state');
                if (savedState !== state) {
                    console.warn('SSO state didn\'t match');

                    if (!this.canGetCompleted()) {
                        new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show();
                    }
                    return;
                }
                Storage.secure.removeItem('oid-state').catch(console.error);
            }
            catch (e) {
                console.error(e);
                if (!this.canGetCompleted()) {
                    new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show();
                }
                return;
            }

            new Toast(error, 'error red').setHide(20000).show();
        }
        else {
            if (error) {
                search.delete('error');

                // Message not authorized
                new Toast($t(`67953842-c829-46b4-8669-752f3dee16c0`), 'error red').setHide(20000).show();
            }
        }

        if (state && msg) {
            search.delete('msg');
            search.delete('s');

            // Check valid state
            try {
                const savedState = await Storage.secure.getItem('oid-state');
                if (savedState !== state) {
                    console.warn('SSO state didn\'t match');
                    // Don't show msg
                    return;
                }
                Toast.success(msg).show();
                Storage.secure.removeItem('oid-state').catch(console.error);
            }
            catch (e) {
                console.error(e);
                return;
            }
        }
    }

    async startSSO(data: { webshopId?: string; prompt?: string; providerType: LoginProviderType }) {
        const spaState = generateId(40);
        try {
            await Storage.secure.setItem('oid-state', spaState);
        }
        catch (e) {
            console.error('Could not save state in local storage');
            new Toast($t(`df9de86b-96ca-46b5-ace0-2f70fbdc2e6e`), 'error red').setHide(20000).show();
            return;
        }

        // Generate code verifier
        // const codeVerifier = await this.generateCodeVerifier();
        // Generate code challenge from code verifier
        // const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        // code_challenge_method = S256

        const url = new URL((STAMHOOFD.environment === 'development' ? 'http://localhost:9091' : this.server.host) + '/openid/start');
        url.searchParams.set('spaState', spaState);
        url.searchParams.set('provider', data.providerType);
        if (data.webshopId) {
            url.searchParams.set('webshopId', data.webshopId);
        }
        if (data.prompt) {
            url.searchParams.set('prompt', data.prompt);
        }

        const redirectUri = new URL(window.location.href);
        if (redirectUri.protocol === 'capacitor:') {
            // On the iOS app, we'll need to rewrite the schema
            redirectUri.protocol = 'https:';
        }
        if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN) {
            redirectUri.searchParams.set('skipRedirect', 'true');
        }
        url.searchParams.set('redirectUri', redirectUri.href);

        if (this.hasToken()) {
            // Request a one-time auth token to connect an external account
            const respponse = await this.authenticatedServer.request({
                method: 'POST',
                path: '/openid/auth-token',
                decoder: OpenIDAuthTokenResponse as Decoder<OpenIDAuthTokenResponse>,
            });
            url.searchParams.set('authToken', respponse.data.ssoAuthToken);
        }

        // Redirect / open url
        window.location.href = url.toString();
    }

    addListener(owner: any, listener: AuthenticationStateListener) {
        this.listeners.set(owner, listener);
    }

    removeListener(owner: any) {
        this.listeners.delete(owner);
    }

    callListeners(changed: 'user' | 'organization' | 'token' | 'preventComplete') {
        for (const listener of this.listeners.values()) {
            listener(changed);
        }
    }

    hasToken(): boolean {
        return !!this.token;
    }

    canGetCompleted(): boolean {
        // console.log("canGetCompleted", this.token, this.user, this.organization, this.preventComplete, this.user?.permissions, this.organization?.privateMeta)
        return !!this.token;
    }

    hasPermissions(): boolean {
        // console.log("canGetCompleted", this.token, this.user, this.organization, this.preventComplete, this.user?.permissions, this.organization?.privateMeta)
        return !!this.auth?.permissions;
    }

    isComplete(): boolean {
        if (!this.token) {
            return false;
        }

        if (!this.user) {
            return false;
        }

        if (this.preventComplete) {
            return false;
        }

        if (this.organization) {
            if (this.auth.permissions && !this.organization.privateMeta) {
                // Private meta is missing while we have permissions for this organization: requires a refetch
                return false;
            }
        }

        return true;
    }

    static serverForOrganization(organizationId: string | null | undefined) {
        const server = NetworkManager.server;
        if (!organizationId) {
            return server;
        }

        server.host = 'https://' + organizationId + '.' + STAMHOOFD.domains.api;
        return server;
    }

    get server() {
        return SessionContext.serverForOrganization(this.organization?.id);
    }

    /**
     * Doing authenticated requests
     */
    get authenticatedServer() {
        if (!this.hasToken()) {
            throw new Error('Could not get authenticated server without token');
        }
        const server = this.server;
        server.middlewares.push(this);
        return server;
    }

    getAuthenticatedServerForOrganization(organizationId: string | null) {
        if (!this.hasToken()) {
            throw new Error('Could not get authenticated server without token');
        }
        const server = SessionContext.serverForOrganization(organizationId);
        server.middlewares.push(this);
        return server;
    }

    get optionalAuthenticatedServer() {
        if (this.hasToken()) {
            return this.authenticatedServer;
        }
        return this.server;
    }

    protected async onTokenChanged() {
        await this.doSaveToStorage();
        this.callListeners('token');
    }

    setTokenWithoutSaving(token: Token, usedPlatformStorage?: boolean) {
        console.log('[SessionContext] Setting Token. Platform: ' + usedPlatformStorage);

        if (this.token) {
            // Disable listener before clearing the token
            this.token.onChange = () => {
                console.error('Oops, old token was updated while we are using a different token');
                // emtpy
            };
        }
        this.token = new ManagedToken(token, async () => {
            await this.onTokenChanged();
        });

        if (usedPlatformStorage !== undefined) {
            this.usedPlatformStorage = usedPlatformStorage;
        }
        this.callListeners('token');
    }

    async setToken(token: Token, usedPlatformStorage?: boolean) {
        await QueueHandler.schedule('session-context-token', async () => {
            this.setTokenWithoutSaving(token, usedPlatformStorage);
            await this.onTokenChanged();
        });
    }

    _lastFetchedUser: Date | null = null;
    _lastFetchedOrganization: Date | null = null;

    async fetchUser(shouldRetry = true): Promise<UserWithMembers> {
        console.log('Fetching session user...');

        if (!isReactive(this)) {
            console.error('SessionContext is not reactive while fetching user!');
        }

        const response = await this.authenticatedServer.request({
            method: 'GET',
            path: '/user',
            decoder: UserWithMembers as Decoder<UserWithMembers>,
            shouldRetry,
        });
        this._lastFetchedUser = new Date();

        if (this.user) {
            this.user.deepSet(response.data);
        }
        else {
            this.user = response.data;
            this.clearAuthCache();
        }
        console.log('Fetched session user');

        if (!isReactive(this.user)) {
            console.error('SessionContext.user is not reactive after fetching user!');
        }

        // Auto copy organization data from the response
        if (this.organization) {
            const returnedOrganization = this.user.members.organizations.find(o => o.id === this.organization?.id);
            if (returnedOrganization) {
                this._lastFetchedOrganization = new Date();
                this.updateOrganization(returnedOrganization);
            }
            else {
                console.warn('Did not find organization in user response');
            }
        }

        await this.saveToStorage();
        this.callListeners('user');
        return this.user;
    }

    /**
     * Set the organization, including the reference
     */
    setOrganization(organization: Organization) {
        this.organization = organization;
        this.callListeners('organization');
    }

    /**
     * Set the organization, but keep the same reference and update
     * other references (like groups) correctly to keep the app reactive
     */
    updateOrganization(organization: Organization) {
        if (!this.organization) {
            this.setOrganization(organization);
            this.clearAuthCache();
            this.callListeners('organization');
        }
        else {
            const oldAdmins = this.organization.admins;

            this.organization.deepSet(organization);

            if (oldAdmins && !this.organization.admins) {
                this.organization.admins = oldAdmins;
            }
            this.clearAuthCache();
            this.callListeners('organization');
        }
    }

    async fetchOrganization(shouldRetry = true): Promise<Organization> {
        if (!this.organization) {
            throw new Error('Cannot fetch organization in a context with no organization');
        }
        console.log('Fetching session organization...');

        const response = await (this.hasToken() ? this.authenticatedServer : this.server).request({
            method: 'GET',
            path: '/organization',
            decoder: Organization as Decoder<Organization>,
            shouldRetry,
        });

        if (this.hasToken() && this.organizationPermissions && !response.data.privateMeta) {
            console.error('Missing privateMeta in authenticated organization response');

            // Critical issue: log out
            this.setLoadingError(new SimpleError({
                code: 'failed',
                message: 'Something went wrong',
                human: $t(`6ef5e456-73f7-4baf-845c-4321094bbc6b`),
            }));
            throw new Error('Missing privateMeta in authenticated organization response');
        }

        this.updateOrganization(response.data);
        this._lastFetchedOrganization = new Date();
        this.callListeners('organization');
        return this.organization!;
    }

    isOutdated(date: Date | null) {
        return date === null || date < new Date(new Date().getTime() - 10 * 1000);
    }

    /**
     *
     * @param force Always fetch new information, even when it is available
     * @param shouldRetry Keep retrying on network or server issues
     * @param background If we don't need to update the data right away, initiate a forced background update
     */
    async updateData(force = false, shouldRetry = true, background = false, skipIfNotOutdated = false) {
        if (force) {
            console.log('SessionContext force update data, background: ', background, skipIfNotOutdated);
        }
        else {
            console.log('SessionContext update data, background: ', background, skipIfNotOutdated);
        }

        if (skipIfNotOutdated) {
            if ((!this.canGetCompleted() || !this.isOutdated(this._lastFetchedUser)) && (!this.organization || !this.isOutdated(this._lastFetchedOrganization))) {
                console.log('Data is not outdated, skipping update');
                return;
            }

            console.log('Data is outdated, updating...', this._lastFetchedUser, this._lastFetchedOrganization);
        }

        try {
            let fetchedUser = false;
            let fetchedOrganization = false;

            if (this.canGetCompleted()) {
                if (force || !this.user) {
                    fetchedUser = true;
                    await this.fetchUser(shouldRetry);

                    // The user also includes the organization, so we don't need to fetch it again
                    fetchedOrganization = true;
                }
            }

            if (this.organization && ((force && !fetchedOrganization) || (this.organizationPermissions && !this.organization.privateMeta))) {
                fetchedOrganization = true;
                await this.fetchOrganization(shouldRetry);
            }

            if (((!fetchedOrganization && this.organization) || (!fetchedUser && this.canGetCompleted())) && background) {
                // Initiate a slow background update without retry
                // = we don't need to block the UI for this ;)
                this.updateData(true, false, false).catch((e) => {
                    // Ignore network errors
                    console.error(e);
                });
            }
        }
        catch (e) {
            console.error('Error while updating session data', e);
            throw e;
        }
    }

    // Logout without clearing this token
    temporaryLogout() {
        console.log('temporary logout');

        // We do not call ontoken changed -> prevent saving!!!!
        // Might still be able to login after a reload (because the error was caused by data errors)
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            };
            this.token = null;
            this.callListeners('token');
        }
        this.user = null;
        this.callListeners('user');
    }

    // Logout without clearing this token
    setLoadingError(error: unknown) {
        this.loadingError = error as Error;
        this.callListeners('token');
        this.callListeners('user');
    }

    isLoggingOut = false;

    async logout(updateUIForLogout = true) {
        if (this.isLoggingOut) {
            // Prevents loops when refreshing inside the logout endpoint
            return;
        }

        if (this.token) {
            this.isLoggingOut = true;
            console.log('Logout');

            // Delete first to prevent loops (could be already invalid so the deletion might fail)
            try {
                await this.authenticatedServer.request({
                    method: 'DELETE',
                    path: '/oauth/token',
                    shouldRetry: false,
                    allowErrorRetry: true, // sometimes we need to refresh a token before we can delete it
                });
            }
            catch (e) {
                if (Request.isNetworkError(e) || Request.isAbortError(e)) {
                    // Network access is required for a reliable logout
                    this.isLoggingOut = false;
                    throw e;
                }
                console.error('Failed to delete token. Probably already deleted?', e);
            }

            this.isLoggingOut = false;
            await this.unsetToken(updateUIForLogout);
        }
    }

    /**
     * Clears the token from memory and storage
     */
    private async unsetToken(updateUIForLogout = true) {
        await QueueHandler.schedule('session-context-token', async () => {
            if (!this.token) {
                return;
            }
            this.token.onChange = () => {
                // emtpy
            };
            this.token = null;
            this.user = null; // force refetch in the future
            await this.deleteFromStorage();

            if (updateUIForLogout) {
                await this.onTokenChanged();
            }
        });
    }

    async deleteAccount() {
        if (this.isLoggingOut) {
            // Prevents loops when refreshing inside the logout endpoint
            return;
        }

        if (this.token) {
            this.isLoggingOut = true;
            console.log('Logout');

            // Delete first to prevent loops (could be already invalid so the deletion might fail)
            try {
                await this.authenticatedServer.request({
                    method: 'DELETE',
                    path: '/user',
                    shouldRetry: false,
                    allowErrorRetry: true, // sometimes we need to refresh a token before we can delete it
                });
            }
            catch (e) {
                if (Request.isNetworkError(e) || Request.isAbortError(e)) {
                    // Network access is required for a reliable logout
                    this.isLoggingOut = false;
                    throw e;
                }
                console.error('Failed to delete token. Probably already deleted?', e);
            }

            this.isLoggingOut = false;
            await this.unsetToken(true);
        }
    }

    // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        // We need to use a queue here, to avoid doing multiple token refreshes at the same time.
        await QueueHandler.schedule('session-context-token', async () => {
            // Check if we have an updated token in storage (other browser tab refreshed the token)
            await this.loadTokenFromStorage();

            if (!this.token) {
                // Euhm? The user is not signed in!
                throw new Error('Could not authenticate request without token');
            }

            if (this.token.isRefreshing() || this.token.needsRefresh()) {
                // Already expired.
                console.log(this.requestPrefix(request) + 'Request started with expired access token, refreshing before starting request...');
                try {
                    await this.token.refresh(this.server, () => request.shouldRetry);
                }
                catch (e) {
                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        if (e.hasCode('invalid_refresh_token')) {
                            this.setLoadingError(e);
                            await this.unsetToken(true);
                            throw new SimpleError({
                                code: '',
                                message: '',
                                human: $t(`6628730c-e78a-4430-a3b6-646999ec821b`),
                            });
                        }
                    }
                    this.setLoadingError(e);
                    throw e;
                }
            }

            request.headers['Authorization'] = 'Bearer ' + this.token.token.accessToken;
        });
    }

    private requestPrefix(request: Request<any>) {
        return '[' + request.method + ' ' + request.path + '] ';
    }

    async shouldRetryError(request: Request<any>, response: XMLHttpRequest, error: SimpleErrors): Promise<boolean> {
        if ((error.hasCode('invalid_organization') || error.hasCode('archived')) && this.organization) {
            // Clear from session storage
            await SessionManager.removeOrganizationFromStorage(this.organization.id);
            this.setLoadingError(error);
            window.location.reload();
            return false;
        }

        if (error.hasCode('not_activated') && !this.isStorageDisabled) {
            // The user is not activated, logout
            // (logout instead of unsetToken because here we probably still have a valid access token which we need to delete)
            await this.logout();
            return false;
        }

        // Only start queue here, because we should never call logout or any other authenticated request
        // inside the queue (queue in queue deadlock)
        return await QueueHandler.schedule('session-context-token', async () => {
            // Load token from storage, because it could have been refreshed in another tab
            await this.loadTokenFromStorage();

            if (!this.token) {
                // Euhm? The user is not signed in!
                return false;
            }

            if (response.status !== 401) {
                return false;
            }

            if (error.hasCode('expired_access_token')) {
                if (request.headers.Authorization !== 'Bearer ' + this.token.token.accessToken) {
                    console.log(this.requestPrefix(request) + 'This request started with an old token that might not be valid anymore. Retry with new token before doing a refresh');
                    return true;
                }

                // Try to refresh
                try {
                    console.log(this.requestPrefix(request) + 'Request failed due to expired access token, refreshing...');
                    await this.token.refresh(this.server, () => request.shouldRetry);
                    console.log(this.requestPrefix(request) + 'Retrying request...');
                }
                catch (e) {
                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        if (e.hasCode('invalid_refresh_token')) {
                            console.log(this.requestPrefix(request) + 'Refresh token is invalid');
                            this.setLoadingError(e);
                            await this.unsetToken(true);
                            return false;
                        }
                    }

                    if (Request.isNetworkError(e) || Request.isAbortError(e)) {
                        return false;
                    }

                    // Something went wrong
                    this.setLoadingError(e);
                    return false;
                }
                return true;
            }
            else {
                if (request.headers.Authorization !== 'Bearer ' + this.token.token.accessToken) {
                    console.log(this.requestPrefix(request) + 'This request started with an old token that might not be valid anymore. Retry with new token');
                    return true;
                }
                else {
                    if (error.hasCode('invalid_access_token')) {
                        await this.unsetToken(true);
                    }
                    else {
                        this.setLoadingError(error);
                    }
                }
            }

            return false;
        });
    }
}
