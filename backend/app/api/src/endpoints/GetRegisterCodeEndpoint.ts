import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';

import { RegisterCode } from '../models/RegisterCode';
import { Token } from '../models/Token';

type Params = {};
type Query = undefined;
type Body = undefined;
type ResponseBody = string;

export class GetRegisterCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/register-code", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (user.permissions === null) {
            throw new SimpleError({
                code: "permission_denied",
                message: "No permissions for this endpoint"
            })
        }

        const code = await RegisterCode.where({ organizationId: user.organizationId })

        if (code.length > 0) {
            const r = new Response(code[0].code);   
            r.headers["Content-Type"] = "text/plain"
            return r;
        }

        const c = new RegisterCode()
        c.organizationId = user.organizationId
        c.description = "Doorverwezen door "+user.organization.name
        await c.generateCode()

        c.value = 10*100
        await c.save()

        const r = new Response(c.code);  
        r.headers["Content-Type"] = "text/plain" 
        return r;
    }
}
