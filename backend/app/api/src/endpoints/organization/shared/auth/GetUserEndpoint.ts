import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Token, User } from '@stamhoofd/models';
import { MyUser, User as UserStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UserStruct|MyUser;

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
        await Context.setOrganizationScope()
        const {user} = await Context.authenticate({allowWithoutAccount: true})

        if (request.request.getVersion() < 243) {
            // Password
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

        const st = UserStruct.create({
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
