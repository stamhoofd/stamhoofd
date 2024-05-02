import { AutoEncoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';

import { AdminToken } from '../../models/AdminToken';

type Params = { id: string};

type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class DeleteOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
       
        const organization = await Organization.getByID(request.params.id)
        if (!organization) {
            throw new SimpleError({
                code: "not_found",
                message: "Organization not found",
                statusCode: 404
            })
        }

        await organization.delete()
        return new Response(undefined);      
    }
}
