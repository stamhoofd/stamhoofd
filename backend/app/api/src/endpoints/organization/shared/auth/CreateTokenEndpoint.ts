import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, PasswordToken, Token, User } from '@stamhoofd/models';
import { ChallengeGrantStruct, CreateTokenStruct, PasswordGrantStruct, PasswordTokenGrantStruct, RefreshTokenGrantStruct, RequestChallengeGrantStruct, SignupResponse, Token as TokenStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = RequestChallengeGrantStruct | ChallengeGrantStruct | RefreshTokenGrantStruct | PasswordTokenGrantStruct | PasswordGrantStruct;
type ResponseBody = TokenStruct;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = CreateTokenStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/oauth/token", {});

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
        const organization = await Context.setOrganizationScope()
        
        switch (request.body.grantType) {
        case "refresh_token": {
            const oldToken = await Token.getByRefreshToken(request.body.refreshToken)
            if (!oldToken) {
                throw new SimpleError({
                    code: "invalid_refresh_token",
                    message: "Invalid refresh token",
                    statusCode: 400
                });
            }

            // Important to create a new token before adjusting the old token
            const token = await Token.createToken(oldToken.user);

            // In the rare event our response doesn't reach the client anymore, we don't want the client to sign out...
            // So we give them a second chance and create a new token BUT we expire our existing token in an hour (forever!)
            oldToken.refreshTokenValidUntil = new Date(Date.now() + 60*60*1000)
            oldToken.accessTokenValidUntil = new Date(Date.now() - 60 * 60 * 1000)

            // Do not delete the old one, only expire it fast so it will get deleted in the future
            await oldToken.save();
   
            if (!token) {
                throw new SimpleError({
                    code: "error",
                    message: "Could not generate token",
                    human: "Er ging iets mis bij het aanmelden",
                    statusCode: 500
                });
            }

            const st = new TokenStruct(token);
            return new Response(st);            
        }

        case "password": {
            // Increase timout for legacy
            request.request.request?.setTimeout(30 * 1000);
            const user = await User.login(organization.id, request.body.username, request.body.password)

            const errBody = {
                code: "invalid_username_or_password",
                message: "Invalid username or password",
                human: "Foutief wachtwoord of onbekend emailadres",
                statusCode: 400
            };

            if (!user) {
                // TODO: increase counter
                throw new SimpleError(errBody);
            }

            // Yay! Valid password
            // Now check if e-mail is already validated
            // if not: throw a validation error (e-mail validation is required)
            if (!user.verified) {
                const code = await EmailVerificationCode.createFor(user, user.email)
                code.send(user, organization, request.i18n)
                
                throw new SimpleError({
                    code: "verify_email",
                    message: "Your email address needs verification",
                    human: "Jouw e-mailadres is nog niet geverifieerd. Verifieer jouw e-mailadres via de link in de e-mail.",
                    meta: SignupResponse.create({
                        token: code.token
                    }).encode({ version: request.request.getVersion() }),
                    statusCode: 403
                });
            }

            const token = await Token.createToken(user);
            
            if (!token) {
                throw new SimpleError({
                    code: "error",
                    message: "Could not generate token",
                    human: "Er ging iets mis bij het aanmelden",
                    statusCode: 500
                });
            }

            const st = new TokenStruct(token);
            return new Response(st);      
        }

        case "password_token": {
            const passwordToken = await PasswordToken.getToken(request.body.token)
            if (!passwordToken) {
                throw new SimpleError({
                    code: "invalid_token",
                    message: "Invalid token",
                    human: "Deze link is ongeldig of is al vervallen. Je zal nogmaals een e-mail moeten versturen om je wachtwoord te herstellen.",
                    statusCode: 400
                });
            }

            // Important to create a new token before adjusting the old token
            const token = await Token.createToken(passwordToken.user);

            // TODO: make token short lived until renewal
   
            if (!token) {
                throw new SimpleError({
                    code: "error",
                    message: "Could not generate token",
                    human: "Er ging iets mis bij het inloggen",
                    statusCode: 500
                });
            }

            // For now we keep the password token because the user might want to reload the page or load it on a different device/browser
            //await passwordToken.delete();

            // Verify this email address, since the user can't change its email address without being verified
            if (!token.user.verified) {
                token.user.verified = true
                await token.user.save()
            }

            const st = new TokenStruct(token);
            return new Response(st);           
        }

        default: {
            // t should always be 'never' so we get no compiler error when this compiles
            // if you get a compiler error here, you missed a possible value for grantType
            throw new Error("Grant type " + request.body.grantType + " not supported");
        }
        }
        
    }
}
