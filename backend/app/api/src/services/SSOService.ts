import { DecodedRequest, Response } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Organization, Platform, Token, User, Webshop } from '@stamhoofd/models';
import { LoginProviderType, OpenIDClientConfiguration, StartOpenIDFlowStruct, Token as TokenStruct } from '@stamhoofd/structures';
import crypto from 'crypto';
import { generators, Issuer } from 'openid-client';
import { Context } from '../helpers/Context';

import { CookieHelper, ObjectWithHeaders } from '../helpers/CookieHelper';

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

type SSOSessionContext = {
    expires: Date;
    code_verifier: string;
    state: string;
    nonce: string;
    redirectUri: string;
    spaState: string;
    providerType: LoginProviderType;

    /**
     * Link this method to this existing user and don't create a new token
     */
    userId?: string | null;
};

export class SSOService {
    provider: LoginProviderType;
    platform: Platform;
    organization: Organization | null;
    user: User | null = null;

    static sessionStorage = new Map<string, SSOSessionContext>();

    constructor(data: { provider: LoginProviderType; platform: Platform; organization?: Organization | null; user?: User | null }) {
        this.provider = data.provider;
        this.platform = data.platform;
        this.organization = data.organization ?? null;
        this.user = data.user ?? null;
    }

    /**
     * This is the redirectUri we'll use towards the provider - but we store a different internal redirectUri in the session to allow more flexibility
     * with the multiple domains we can redirect to.
     */
    get externalRedirectUri() {
        if (this.configuration.redirectUri) {
            return this.configuration.redirectUri;
        }
        // todo: we might need a special url for the app here

        if (!this.organization) {
            return 'https://' + STAMHOOFD.domains.api + '/openid/callback';
        }
        return 'https://' + this.organization.id + '.' + STAMHOOFD.domains.api + '/openid/callback';
    }

    get defaultRedirectUri() {
        // Host should match correctly
        let redirectUri = 'https://' + STAMHOOFD.domains.dashboard;

        if (this.organization) {
            redirectUri = 'https://' + this.organization.getHost();
        }
        return redirectUri;
    }

    static async fromContext(provider: LoginProviderType) {
        const organization = Context.organization;
        const platform = await Platform.getShared();

        const service = new SSOService({ provider, platform, organization, user: Context.user });
        // Validate configuration
        const _ = service.configuration;
        return service;
    }

    get configuration() {
        let configuration: OpenIDClientConfiguration | null = null;

        if (this.provider === LoginProviderType.SSO) {
            if (this.organization) {
                configuration = this.organization.serverMeta.ssoConfiguration ?? OpenIDClientConfiguration.create({});
            }
            else {
                configuration = this.platform.serverConfig.ssoConfiguration ?? OpenIDClientConfiguration.create({});
            }
        }
        else if (this.provider === LoginProviderType.Google) {
            if (this.organization) {
                // Not supported yet
                configuration = null;
            }
            else {
                configuration = this.platform.serverConfig.googleConfiguration ?? OpenIDClientConfiguration.create({});
            }
        }

        if (!configuration) {
            throw new SimpleError({
                code: 'invalid_client',
                message: 'SSO not configured',
                statusCode: 400,
            });
        }
        return configuration;
    }

    async setConfiguration(configuration: OpenIDClientConfiguration) {
        if (this.provider === LoginProviderType.SSO) {
            if (this.organization) {
                this.organization.serverMeta.ssoConfiguration = configuration;
                await this.getClient();
                await this.organization.save();
                return;
            }
            else {
                this.platform.serverConfig.ssoConfiguration = configuration;
                await this.getClient();
                await this.platform.save();
                return;
            }
        }
        else if (this.provider === LoginProviderType.Google) {
            if (!this.organization) {
                this.platform.serverConfig.googleConfiguration = configuration;
                await this.getClient();
                await this.platform.save();
                return;
            }
        }

        throw new SimpleError({
            code: 'invalid_client',
            message: 'SSO not supported here',
            statusCode: 400,
        });
    }

    async getClient() {
        const issuer = await Issuer.discover(this.configuration.issuer);
        const client = new issuer.Client({
            client_id: this.configuration.clientId,
            client_secret: this.configuration.clientSecret,
            redirect_uris: [this.externalRedirectUri],
            response_types: ['code'],
        });

        // Todo: in the future we can add a cache here

        return client;
    }

    static async storeSession(response: Response<any>, data: SSOSessionContext) {
        const sessionId = (await randomBytes(192)).toString('base64');

        // Delete expired sessions
        for (const [key, value] of this.sessionStorage) {
            if (value.expires < new Date()) {
                this.sessionStorage.delete(key);
            }
        }

        this.sessionStorage.set(sessionId, data);

        // Store
        CookieHelper.setCookie(response, 'oid_session_id', sessionId, {
            httpOnly: true,
            secure: STAMHOOFD.environment !== 'development',
            expires: data.expires,
        });
    }

    static getSession(request: ObjectWithHeaders): SSOSessionContext | null {
        const sessionId = CookieHelper.getCookie(request, 'oid_session_id');
        if (!sessionId) {
            return null;
        }

        const session = this.sessionStorage.get(sessionId);
        if (!session) {
            return null;
        }

        if (session.expires < new Date()) {
            return null;
        }

        return session;
    }

    async validateAndStartAuthCodeFlow(data: StartOpenIDFlowStruct) {
        // Host should match correctly
        let redirectUri = this.defaultRedirectUri;

        // todo: also support the app as redirect uri using app schemes (could be required for mobile apps)
        const webshopId = data.webshopId;

        if (webshopId) {
            if (!this.organization) {
                throw new SimpleError({
                    code: 'invalid_organization',
                    message: 'Organization required when specifying webshopId',
                    statusCode: 400,
                });
            }

            const webshop = await Webshop.getByID(webshopId);
            if (!webshop || webshop.organizationId !== this.organization.id) {
                throw new SimpleError({
                    code: 'invalid_webshop',
                    message: 'Invalid webshop',
                    statusCode: 400,
                });
            }
            redirectUri = 'https://' + webshop.setRelation(Webshop.organization, this.organization).getHost();
        }

        if (data.redirectUri) {
            try {
                const allowedHost = new URL(redirectUri);
                const givenUrl = new URL(data.redirectUri);

                if (allowedHost.host === givenUrl.host && givenUrl.protocol === 'https:') {
                    redirectUri = givenUrl.href;
                }
                else {
                    throw new SimpleError({
                        code: 'redirect_uri_not_allowed',
                        message: 'Redirect uri not allowed',
                        field: 'redirectUri',
                        statusCode: 400,
                    });
                }
            }
            catch (e) {
                throw new SimpleError({
                    code: 'invalid_redirect_uri',
                    message: 'Invalid redirect uri',
                    field: 'redirectUri',
                    statusCode: 400,
                });
            }
        }

        if (data.spaState.length < 10) {
            throw new SimpleError({
                code: 'invalid_state',
                message: 'Invalid state',
                statusCode: 400,
            });
        }

        return await this.startAuthCodeFlow(redirectUri, data.spaState, data.prompt);
    }

    async startAuthCodeFlow(redirectUri: string, spaState: string, prompt: string | null = null): Promise<Response<undefined>> {
        const code_verifier = generators.codeVerifier();
        const state = generators.state();
        const nonce = generators.nonce();
        const code_challenge = generators.codeChallenge(code_verifier);
        const expires = new Date(Date.now() + 1000 * 60 * 15);

        const session: SSOSessionContext = {
            expires,
            code_verifier,
            state,
            nonce,
            redirectUri,
            spaState,
            providerType: this.provider,
            userId: Context.user?.id ?? null,
        };

        try {
            const response = new Response(undefined);

            const client = await this.getClient();
            await SSOService.storeSession(response, session);

            const redirect = client.authorizationUrl({
                scope: 'openid email profile',
                code_challenge,
                code_challenge_method: 'S256',
                response_mode: 'form_post',
                response_type: 'code',
                state,
                nonce,
                prompt: prompt ?? undefined,
                login_hint: this.user?.email ?? undefined,
                redirect_uri: this.externalRedirectUri,
            });

            response.headers['location'] = redirect;
            response.status = 302;

            return response;
        }
        catch (e) {
            const message = (isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : 'Er ging iets mis.');
            console.error('Error in openID callback', e);
            return SSOServiceWithSession.getErrorRedirectResponse(session, message);
        }
    }
}

export class SSOServiceWithSession {
    session: SSOSessionContext;
    service: SSOService;
    request: DecodedRequest<any, any, any>;

    constructor(session: SSOSessionContext, service: SSOService, request: DecodedRequest<any, any, any>) {
        this.session = session;
        this.service = service;
        this.request = request;
    }

    static async fromSession(request: DecodedRequest<any, any, any>): Promise<SSOServiceWithSession> {
        const session = SSOService.getSession(request);

        if (!session) {
            throw new Error('Missing session');
        }

        const service = await SSOService.fromContext(session.providerType);

        return new SSOServiceWithSession(session, service, request);
    }

    async callback(): Promise<Response<undefined>> {
        const session = SSOService.getSession(Context.request);

        if (!session) {
            throw new Error('Missing session');
        }

        try {
            const response = new Response(undefined);
            const client = await this.service.getClient();

            const tokenSet = await client.callback(this.service.externalRedirectUri, this.request.body as Record<string, unknown>, {
                code_verifier: session.code_verifier,
                state: session.state,
                nonce: session.nonce,
            });

            console.log('received and validated tokens %j', tokenSet);

            const claims = tokenSet.claims();
            console.log('validated ID Token claims %j', claims);

            if (!claims.name) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: 'Missing name',
                    statusCode: 400,
                });
            }

            let firstName = claims.name.split(' ')[0];
            let lastName = claims.name.split(' ').slice(1).join(' ');

            // Get from API
            if (tokenSet.access_token) {
                const userinfo = await client.userinfo(tokenSet.access_token);
                console.log('userinfo', userinfo);

                if (userinfo.given_name) {
                    console.log('userinfo given_name', userinfo.given_name);
                    firstName = userinfo.given_name;
                }

                if (userinfo.family_name) {
                    console.log('userinfo family_name', userinfo.family_name);
                    lastName = userinfo.family_name;
                }
            }

            if (!claims.email) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: 'Missing email address',
                    statusCode: 400,
                });
            }

            if (!claims.sub) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: 'Missing sub',
                    statusCode: 400,
                });
            }

            // Get user from database
            let user = await User.getForRegister(this.service.organization?.id ?? null, claims.email);
            if (!user) {
                if (this.session.userId) {
                    throw new SimpleError({
                        code: 'invalid_user',
                        message: 'User not found: please log in with the same email address as the user you are trying to link',
                        human: 'Je moet inloggen met hetzelfde e-mailadres als het account dat je probeert te koppelen',
                        statusCode: 404,
                    });
                }

                // Create a new user
                user = await User.registerSSO(this.service.organization, {
                    id: undefined,
                    email: claims.email,
                    firstName,
                    lastName,
                    type: session.providerType,
                    sub: claims.sub,
                });

                if (!user) {
                    throw new SimpleError({
                        code: 'invalid_user',
                        message: 'Failed to create user',
                        statusCode: 500,
                    });
                }
            }
            else {
                if (this.session.userId && user.id !== this.session.userId) {
                    throw new SimpleError({
                        code: 'invalid_user',
                        message: 'User or email mismatch',
                        statusCode: 400,
                    });
                }

                // Update name
                if (!user.firstName || !user.hasPasswordBasedAccount()) {
                    user.firstName = firstName;
                }
                if (!user.lastName || !user.hasPasswordBasedAccount()) {
                    user.lastName = lastName;
                }
                user.linkLoginProvider(this.service.provider, claims.sub, !!this.session.userId);
                await user.save();
            }

            // Redirect back
            const redirectUri = new URL(session.redirectUri);

            if (!this.session.userId) {
                const token = await Token.createExpiredToken(user);

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: 'Er ging iets mis bij het aanmelden',
                        statusCode: 500,
                    });
                }

                const st = new TokenStruct(token);
                redirectUri.searchParams.set('oid_rt', st.refreshToken);
                redirectUri.searchParams.set('s', session.spaState);
            }
            else {
                redirectUri.searchParams.set('s', session.spaState);
                redirectUri.searchParams.set('msg', 'Je account is succesvol gekoppeld');
            }

            response.headers['location'] = redirectUri.toString();
            response.status = 302;

            return response;
        }
        catch (e) {
            const message = (isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : 'Er ging iets mis.');
            console.error('Error in openID callback', e);
            return SSOServiceWithSession.getErrorRedirectResponse(session, message);
        }
    }

    static getErrorRedirectResponse(session: SSOSessionContext, errorMessage: string) {
        const response = new Response(undefined);

        // Redirect back to webshop
        const redirectUri = new URL(session.redirectUri);
        redirectUri.searchParams.set('s', session.spaState);
        redirectUri.searchParams.set('error', errorMessage);

        response.headers['location'] = redirectUri.toString();
        response.status = 302;

        return response;
    }
}
