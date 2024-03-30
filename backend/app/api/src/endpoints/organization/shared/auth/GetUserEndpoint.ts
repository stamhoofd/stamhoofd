import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Token, User } from '@stamhoofd/models';
import { MyUser } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MyUser;

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
        const token = await Token.authenticate(request, {allowWithoutAccount: true});

        // Get user unrestriced
        const user = await User.getFull(token.user.id)

        if (!user) {
            throw new Error("Unexpected error")
        }

        const st = MyUser.create({
            firstName: user.firstName,
            lastName: user.lastName,
            id: user.id,
            email: user.email,
            verified: user.verified,
            permissions: user.permissions,
            hasAccount: user.hasAccount()
        })
        return new Response(st);
    }
}
