import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Admin as AdminStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = AdminStruct;

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
        const admin = await AdminToken.authenticate(request);

        const st = AdminStruct.create({
            id: admin.id,
            email: admin.email,
        })
        return new Response(st);      
    
    }
}
