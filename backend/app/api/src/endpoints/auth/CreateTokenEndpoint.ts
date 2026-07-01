import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, MFATOTP, MFAToken, PasswordToken, Platform, Token, User, WebauthnCredential } from '@stamhoofd/models';
import type { ChallengeGrantStruct, MFAGrantStruct, PasswordGrantStruct, PasswordTokenGrantStruct, RefreshTokenGrantStruct, RequestChallengeGrantStruct } from '@stamhoofd/structures';
import { CreateTokenStruct, LoginMethod, MFAMethodType, MFASetupResponse, SignupResponse, Token as TokenStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { TOTPHelper } from '../../helpers/TOTPHelper.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';
import { WebauthnHelper } from '../../helpers/WebauthnHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = RequestChallengeGrantStruct | ChallengeGrantStruct | RefreshTokenGrantStruct | PasswordTokenGrantStruct | PasswordGrantStruct | MFAGrantStruct;
type ResponseBody = TokenStruct;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = CreateTokenStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/oauth/token', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // TODO: add some extra brute force measurements here
        // - add random delay here, increased by the amount of failed attempts (used to slow down). Also on a successfull comparison!
        // - add required CAPTCHA after x failed attempts for a given username (no matter if the username exists or not)
        // - if, even after the CAPTCHAs, the account reaches a given count of failed attempts, the account should be locked out for an hour or even a day (only login endpoint)
        // - check if not multiple attempts for the same username are started in parallel
        // - Limit the amount of failed attemps by IP (will only make it a bit harder)
        // - Detect attacks on random accounts (using email list + most used passwords) and temorary require CAPTCHA on all accounts
        const organization = await Context.setOptionalOrganizationScope({ willAuthenticate: false });

        switch (request.body.grantType) {
            case 'refresh_token': {
                const oldToken = await Token.getByRefreshToken(request.body.refreshToken);
                if (!oldToken) {
                    throw new SimpleError({
                        code: 'invalid_refresh_token',
                        message: 'Invalid refresh token',
                        statusCode: 400,
                    });
                }

                if (oldToken.user.organizationId !== null && oldToken.user.organizationId !== (organization?.id ?? null)) {
                // Invalid scope
                    throw new SimpleError({
                        code: 'invalid_refresh_token',
                        message: 'Invalid refresh token',
                        statusCode: 400,
                    });
                }

                // Important to create a new token before adjusting the old token
                const token = await Token.createToken(oldToken.user);

                // In the rare event our response doesn't reach the client anymore, we don't want the client to sign out...
                // So we allow a small rotation overlap period
                const leeway = 60 * 1000;
                oldToken.refreshTokenValidUntil = new Date(Math.min(oldToken.refreshTokenValidUntil.getTime(), Date.now() + leeway));

                // Invalidate the corresponding access token
                oldToken.accessTokenValidUntil = new Date(Date.now() - 60 * 60 * 1000);

                // Do not delete the old one, only expire it fast so it will get deleted in the future
                await oldToken.save();

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: $t(`%D6`),
                        statusCode: 500,
                    });
                }

                const st = new TokenStruct(token);
                return new Response(st);
            }

            case 'password': {
                if (STAMHOOFD.userMode === 'platform') {
                    const platform = await Platform.getSharedPrivateStruct();
                    const config = platform.config.loginMethods.get(LoginMethod.Password);
                    if (!config) {
                        throw new SimpleError({
                            code: 'not_supported',
                            message: 'This platform does not support password login',
                            human: $t(`%D7`),
                            statusCode: 400,
                        });
                    }

                    if (!config.isEnabledForEmail(request.body.username)) {
                        throw new SimpleError({
                            code: 'not_supported',
                            message: 'Login method not supported',
                            human: $t(`%D8`),
                            statusCode: 400,
                        });
                    }
                }

                const user = await User.login(organization?.id ?? null, request.body.username, request.body.password);

                const errBody = {
                    code: 'invalid_username_or_password',
                    message: 'Invalid username or password',
                    human: $t(`%D9`),
                    statusCode: 400,
                };

                if (!user) {
                // TODO: increase counter
                    throw new SimpleError(errBody);
                }

                // Yay! Valid password
                // Now check if e-mail is already validated
                // if not: throw a validation error (e-mail validation is required)
                if (!user.verified) {
                    const code = await EmailVerificationCode.createFor(user, user.email);
                    code.send(user, organization, request.i18n).catch(console.error);

                    throw new SimpleError({
                        code: 'verify_email',
                        message: 'Your email address needs verification',
                        human: $t(`%DA`),
                        meta: SignupResponse.create({
                            token: code.token,
                        }).encode({ version: request.request.getVersion() }),
                        statusCode: 403,
                    });
                }

                // Second factor: if the user has enrolled factors, require them before
                // issuing a session token (follows the verify_email idiom).
                if (await TwoFactorHelper.userHasFactors(user.id)) {
                    const challenge = await TwoFactorHelper.createLoginChallenge(user);
                    throw new SimpleError({
                        code: 'require_mfa',
                        message: 'Two-factor authentication required',
                        human: $t('Tweestapsverificatie is vereist om aan te melden.'),
                        meta: challenge.encode({ version: request.request.getVersion() }),
                        statusCode: 403,
                    });
                }

                // Forced enrollment: the user is required to have 2FA but has none yet.
                if (TwoFactorHelper.isTwoFactorRequired(user, organization)) {
                    const setup = await MFAToken.createFor(user.id, 'setup');
                    throw new SimpleError({
                        code: 'require_mfa_setup',
                        message: 'Two-factor authentication setup required',
                        human: $t('Je moet tweestapsverificatie instellen voor je verder kan.'),
                        meta: MFASetupResponse.create({
                            setupToken: setup.token,
                        }).encode({ version: request.request.getVersion() }),
                        statusCode: 403,
                    });
                }

                const token = await Token.createToken(user, new Date());

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: $t(`%D6`),
                        statusCode: 500,
                    });
                }

                const st = new TokenStruct(token);
                return new Response(st);
            }

            case 'mfa': {
                const mfaToken = await MFAToken.getValid(request.body.mfaToken, 'login');
                if (!mfaToken) {
                    throw new SimpleError({
                        code: 'invalid_mfa_token',
                        message: 'The MFA session is invalid or expired',
                        human: $t('Je sessie is verlopen. Meld je opnieuw aan.'),
                        statusCode: 400,
                    });
                }

                const user = await User.getByID(mfaToken.userId);
                if (!user) {
                    await mfaToken.consume();
                    throw new SimpleError({
                        code: 'invalid_mfa_token',
                        message: 'The MFA session is invalid or expired',
                        human: $t('Je sessie is verlopen. Meld je opnieuw aan.'),
                        statusCode: 400,
                    });
                }

                // Scope check (same rules as refresh/password_token)
                if ((organization && user.organizationId && user.organizationId !== organization.id) || (!organization && user.organizationId)) {
                    throw new SimpleError({
                        code: 'invalid_mfa_token',
                        message: 'The MFA session is invalid or expired',
                        human: $t('Je sessie is verlopen. Meld je opnieuw aan.'),
                        statusCode: 400,
                    });
                }

                let verified = false;
                if (request.body.method === MFAMethodType.TOTP) {
                    const code = request.body.code ?? '';
                    for (const totp of await MFATOTP.getConfirmedForUser(user.id)) {
                        if (TOTPHelper.verify(code, totp.secret)) {
                            totp.lastUsedAt = new Date();
                            await totp.save();
                            verified = true;
                            break;
                        }
                    }
                }
                else if (request.body.method === MFAMethodType.RecoveryCode) {
                    verified = await RecoveryCodeHelper.consume(user.id, request.body.code ?? '');
                }
                else if (request.body.method === MFAMethodType.Passkey) {
                    const assertion = request.body.assertion;
                    const credentialId = assertion?.id;
                    if (mfaToken.webauthnChallenge && assertion && credentialId) {
                        const credential = await WebauthnCredential.getByCredentialId(credentialId);
                        if (credential && credential.userId === user.id) {
                            const newCounter = await WebauthnHelper.verifyAuthentication(assertion, mfaToken.webauthnChallenge, credential);
                            if (newCounter !== null) {
                                credential.counter = newCounter;
                                credential.lastUsedAt = new Date();
                                await credential.save();
                                verified = true;
                            }
                        }
                    }
                }

                if (!verified) {
                    const locked = await mfaToken.registerFailedAttempt();
                    throw new SimpleError({
                        code: locked ? 'too_many_attempts' : 'invalid_mfa_code',
                        message: locked ? 'Too many attempts' : 'Invalid code',
                        human: locked ? $t('Te veel pogingen. Meld je opnieuw aan.') : $t('De ingevoerde code is ongeldig.'),
                        statusCode: locked ? 429 : 400,
                    });
                }

                await mfaToken.consume();

                const token = await Token.createToken(user, new Date());
                const st = new TokenStruct(token);
                return new Response(st);
            }

            case 'password_token': {
                const passwordToken = await PasswordToken.getToken(request.body.token);
                if (!passwordToken) {
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`%DB`),
                        statusCode: 400,
                    });
                }

                // Check scope
                if (organization && passwordToken.user.organizationId && passwordToken.user.organizationId !== organization.id) {
                // user of a different organization
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`%DB`),
                        statusCode: 400,
                    });
                }

                if (!organization && passwordToken.user.organizationId) {
                // User is scoped to a single organization, while the request is not
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`%DB`),
                        statusCode: 400,
                    });
                }

                // Important to create a new token before adjusting the old token
                const token = await Token.createToken(passwordToken.user, new Date());

                // TODO: make token short lived until renewal

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: $t(`%DC`),
                        statusCode: 500,
                    });
                }

                // For now we keep the password token because the user might want to reload the page or load it on a different device/browser
                // await passwordToken.delete();

                // Verify this email address, since the user can't change its email address without being verified
                if (!token.user.verified) {
                    token.user.verified = true;
                    await token.user.save();
                }

                const st = new TokenStruct(token);
                return new Response(st);
            }

            default: {
            // t should always be 'never' so we get no compiler error when this compiles
            // if you get a compiler error here, you missed a possible value for grantType
                throw new Error('Grant type ' + request.body.grantType + ' not supported');
            }
        }
    }
}
