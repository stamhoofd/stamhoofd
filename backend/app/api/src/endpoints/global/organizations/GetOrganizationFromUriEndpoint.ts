import { AutoEncoder, Decoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { Organization as OrganizationStruct } from "@stamhoofd/structures";
import { GoogleTranslateHelper } from "@stamhoofd/utility";
import { AuthenticatedStructures } from "../../../helpers/AuthenticatedStructures";
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uri: string;
}

type Body = undefined
type ResponseBody = OrganizationStruct;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationFromUriEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization-from-uri", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.getByURI(request.query.uri)

        if (!organization) {
            throw new SimpleError({
                code: "unknown_organization",
                message: "No organization registered with this uri",
                statusCode: 404
            })
        }
        return new Response(await AuthenticatedStructures.organization(organization));
    }
}
