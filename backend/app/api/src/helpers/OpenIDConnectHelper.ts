import { DecodedRequest, Response } from "@simonbackx/simple-endpoints";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { Organization, Token, User } from "@stamhoofd/models";
import { LoginProviderType, OpenIDClientConfiguration, Token as TokenStruct } from "@stamhoofd/structures";
import crypto from "crypto";
import { generators, Issuer } from 'openid-client';

import { CookieHelper } from "./CookieHelper";

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

type SessionContext = {
    expires: Date,
    code_verifier: string,
    state: string,
    nonce: string
    redirectUri: string,
    spaState: string,
    providerType: LoginProviderType
};

export class OpenIDConnectHelper {
    organization: Organization
    configuration: OpenIDClientConfiguration

    static sessionStorage = new Map<string, SessionContext>()

    constructor(organization, configuration: OpenIDClientConfiguration) {
        this.organization = organization
        this.configuration = configuration
    }

    get redirectUri() {
        return 'https://' + this.organization.id + '.' + STAMHOOFD.domains.api + '/openid/callback'
    }

    async getClient() {
        const issuer = await Issuer.discover(this.configuration.issuer);
        const client = new issuer.Client({
            client_id: this.configuration.clientId,
            client_secret: this.configuration.clientSecret,
            redirect_uris: [this.redirectUri],
            response_types: ['code'],
        });

        // Todo: in the future we can add a cache here

        return client;
    }

    static async storeSession(response: Response<any>, data: SessionContext) {
        const sessionId = (await randomBytes(192)).toString("base64");

        // Delete expired sessions
        for (const [key, value] of this.sessionStorage) {
            if (value.expires < new Date()) {
                this.sessionStorage.delete(key)
            }
        }

        this.sessionStorage.set(sessionId, data);

        // Store
        CookieHelper.setCookie(response, "oid_session_id", sessionId, {
            httpOnly: true,
            secure: true,
            expires: data.expires
        })
    }

    static getSession(request: DecodedRequest<any, any, any>): SessionContext | null {
        const sessionId = CookieHelper.getCookie(request, "oid_session_id")
        if (!sessionId) {
            return null
        }

        const session = this.sessionStorage.get(sessionId)
        if (!session) {
            return null
        }

        if (session.expires < new Date()) {
            return null
        }

        return session
    }

    async startAuthCodeFlow(redirectUri: string, providerType: LoginProviderType, spaState: string, prompt: string | null = null): Promise<Response<undefined>> {
        const code_verifier = generators.codeVerifier();
        const state = generators.state();
        const nonce = generators.nonce();
        const code_challenge = generators.codeChallenge(code_verifier);
        const expires = new Date(Date.now() + 1000 * 60 * 15);

        const session: SessionContext = {
            expires,
            code_verifier,
            state,
            nonce,
            redirectUri,
            spaState,
            providerType
        };

        try {
            const response = new Response(undefined);

            const client = await this.getClient()
            await OpenIDConnectHelper.storeSession(response, session);

            const redirect = client.authorizationUrl({
                scope: 'openid email profile',
                code_challenge,
                code_challenge_method: 'S256',
                response_mode: 'form_post',
                response_type: 'code',
                state,
                nonce,
                prompt: prompt ?? undefined
            });

            response.headers['location'] = redirect;
            response.status = 302;

            return response;
        } catch (e) {
            const message = (isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : 'Er ging iets mis.')
            console.error('Error in openID callback', e)
            return OpenIDConnectHelper.getErrorRedirectResponse(session, message)
        }
    }

    async callback(request: DecodedRequest<any, any, any>): Promise<Response<undefined>> {
        const session = OpenIDConnectHelper.getSession(request)

        if (!session) {
            throw new Error("Missing session")
        }

        try {
            const response = new Response(undefined);
            const client = await this.getClient()

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const tokenSet = await client.callback(this.redirectUri, request.body, { 
                code_verifier: session.code_verifier,
                state: session.state,
                nonce: session.nonce
            });

            console.log('received and validated tokens %j', tokenSet);
            
            const claims = tokenSet.claims();
            console.log('validated ID Token claims %j', claims);

            if (!claims.name) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: "Missing name",
                    statusCode: 400
                })
            }

            let firstName = claims.name.split(" ")[0]
            let lastName = claims.name.split(" ").slice(1).join(" ")

            // Get from API
            if (tokenSet.access_token) {
                const userinfo = await client.userinfo(tokenSet.access_token);
                console.log('userinfo', userinfo);

                if (userinfo.given_name) {
                    console.log('userinfo given_name', userinfo.given_name);
                    firstName = userinfo.given_name
                }

                if (userinfo.family_name) {
                    console.log('userinfo family_name', userinfo.family_name);
                    lastName = userinfo.family_name
                }
            }

            if (!claims.email) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: "Missing email address",
                    statusCode: 400
                })
            }

            if (!claims.sub) {
                throw new SimpleError({
                    code: 'invalid_user',
                    message: "Missing sub",
                    statusCode: 400
                })
            }

            // Get user from database
            let user = await User.getOrganizationLevelUser(this.organization.id, claims.email)
            if (!user) {
                // Create a new user
                user = await User.registerSSO(this.organization, {
                    id: undefined,
                    email: claims.email,
                    firstName,
                    lastName,
                    type: session.providerType,
                    sub: claims.sub,
                })

                if (!user) {
                    throw new SimpleError({
                        code: 'invalid_user',
                        message: "Failed to create user",
                        statusCode: 500
                    })
                }
            } else {
                // Update name
                if (!user.firstName || !user.hasPasswordBasedAccount()) {
                    user.firstName = firstName
                }
                if (!user.lastName || !user.hasPasswordBasedAccount()) {
                    user.lastName = lastName
                }
                user.linkLoginProvider(session.providerType, claims.sub)
                await user.save()
            }

            const token = await Token.createExpiredToken(user);
            
            if (!token) {
                throw new SimpleError({
                    code: "error",
                    message: "Could not generate token",
                    human: "Er ging iets mis bij het aanmelden",
                    statusCode: 500
                });
            }

            const st = new TokenStruct(token);

            // Redirect back to webshop
            const redirectUri = new URL(session.redirectUri)
            redirectUri.searchParams.set("oid_rt", st.refreshToken)
            redirectUri.searchParams.set("s", session.spaState)

            response.headers['location'] = redirectUri.toString();
            response.status = 302;

            return response;
        } catch (e) {
            const message = (isSimpleError(e) || isSimpleErrors(e) ? e.getHuman() : 'Er ging iets mis.')
            console.error('Error in openID callback', e)
            return OpenIDConnectHelper.getErrorRedirectResponse(session, message)
        }
    }

    static getErrorRedirectResponse(session: SessionContext, errorMessage: string) {
        const response = new Response(undefined);

        // Redirect back to webshop
        const redirectUri = new URL(session.redirectUri)
        redirectUri.searchParams.set("s", session.spaState)
        redirectUri.searchParams.set("error", errorMessage)

        response.headers['location'] = redirectUri.toString();
        response.status = 302;

        return response;
    }
}