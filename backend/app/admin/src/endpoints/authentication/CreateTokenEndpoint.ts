import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChallengeGrantStruct, CreateTokenStruct, PasswordGrantStruct, PasswordTokenGrantStruct, RefreshTokenGrantStruct, RequestChallengeGrantStruct, Token as TokenStruct } from '@stamhoofd/structures';

import { Admin } from '../../models/Admin';
import { AdminToken } from '../../models/AdminToken';

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
        
        switch (request.body.grantType) {
        case "password": {
            const admin = await Admin.login(request.body.username, request.body.password)

            const errBody = {
                code: "invalid_username_or_password",
                message: "Invalid username or password",
                statusCode: 400
            };

            if (!admin) {
                // TODO: increase counter
                throw new SimpleError(errBody);
            }

            // TODO
            const token = await AdminToken.createToken(admin);
            
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

        case "refresh_token": {
            const oldToken = await AdminToken.getByRefreshToken(request.body.refreshToken)
            if (!oldToken) {
                throw new SimpleError({
                    code: "invalid_refresh_token",
                    message: "Invalid refresh token",
                    statusCode: 400
                });
            }

            // Important to create a new token before adjusting the old token
            const token = await AdminToken.createToken(oldToken.admin);

            // Delete the old token
            await oldToken.delete()
   
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

        default: {
            // t should always be 'never' so we get no compiler error when this compiles
            // if you get a compiler error here, you missed a possible value for grantType
            const t = request.body;
            throw new Error("Type " + t + " not supported");
        }
        }
        
    }
}
