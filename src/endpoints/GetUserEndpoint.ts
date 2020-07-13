import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { NewUser } from '@stamhoofd/structures';

import { Token } from '../models/Token';
import { User } from '../models/User';

type Params = {};
type Query = undefined;
type Body = undefined;
type ResponseBody = NewUser;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);

        // Get user unrestriced
        const user = await User.getFull(token.user.id)

        if (!user) {
            throw new Error("Unexpected error")
        }

        const st = NewUser.create({
            id: user.id,
            email: user.email,
            publicKey: user.publicKey,
            publicAuthSignKey: user.publicAuthSignKey,
            authSignKeyConstants: user.authSignKeyConstants,
            authEncryptionKeyConstants: user.authEncryptionKeyConstants,
            encryptedPrivateKey: user.encryptedPrivateKey,
            permissions: user.permissions
        })
        return new Response(st);      
    
    }
}
