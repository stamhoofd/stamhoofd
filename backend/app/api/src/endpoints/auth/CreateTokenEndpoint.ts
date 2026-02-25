import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, PasswordToken, Platform, Token, User } from '@stamhoofd/models';
import { ChallengeGrantStruct, CreateTokenStruct, LoginMethod, PasswordGrantStruct, PasswordTokenGrantStruct, RefreshTokenGrantStruct, RequestChallengeGrantStruct, SignupResponse, Token as TokenStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = RequestChallengeGrantStruct | ChallengeGrantStruct | RefreshTokenGrantStruct | PasswordTokenGrantStruct | PasswordGrantStruct;
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
                        human: $t(`f40ddd3d-a986-4ec1-9db8-32ec1376c4e8`),
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
                            human: $t(`4af15b54-0bbb-4112-adf2-26dd14e8675a`),
                            statusCode: 400,
                        });
                    }

                    if (!config.isEnabledForEmail(request.body.username)) {
                        throw new SimpleError({
                            code: 'not_supported',
                            message: 'Login method not supported',
                            human: $t(`ca4ca221-2ce9-4472-b8c7-1a5b2e2fdfa9`),
                            statusCode: 400,
                        });
                    }
                }

                const user = await User.login(organization?.id ?? null, request.body.username, request.body.password);

                const errBody = {
                    code: 'invalid_username_or_password',
                    message: 'Invalid username or password',
                    human: $t(`ef53eb8d-b0ba-4e84-b0e3-1865729aeaa8`),
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
                        human: $t(`0da8cd34-d33e-4b54-94f2-531919f3cae1`),
                        meta: SignupResponse.create({
                            token: code.token,
                        }).encode({ version: request.request.getVersion() }),
                        statusCode: 403,
                    });
                }

                const token = await Token.createToken(user);

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: $t(`f40ddd3d-a986-4ec1-9db8-32ec1376c4e8`),
                        statusCode: 500,
                    });
                }

                const st = new TokenStruct(token);
                return new Response(st);
            }

            case 'password_token': {
                const passwordToken = await PasswordToken.getToken(request.body.token);
                if (!passwordToken) {
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`dc03dd54-96e9-42b8-811b-3f8cf2b8534f`),
                        statusCode: 400,
                    });
                }

                // Check scope
                if (organization && passwordToken.user.organizationId && passwordToken.user.organizationId !== organization.id) {
                // user of a different organization
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`dc03dd54-96e9-42b8-811b-3f8cf2b8534f`),
                        statusCode: 400,
                    });
                }

                if (!organization && passwordToken.user.organizationId) {
                // User is scoped to a single organization, while the request is not
                    throw new SimpleError({
                        code: 'invalid_token',
                        message: 'Invalid token',
                        human: $t(`dc03dd54-96e9-42b8-811b-3f8cf2b8534f`),
                        statusCode: 400,
                    });
                }

                // Important to create a new token before adjusting the old token
                const token = await Token.createToken(passwordToken.user);

                // TODO: make token short lived until renewal

                if (!token) {
                    throw new SimpleError({
                        code: 'error',
                        message: 'Could not generate token',
                        human: $t(`b75bc5af-7711-4905-a324-3dca313bbfc2`),
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
