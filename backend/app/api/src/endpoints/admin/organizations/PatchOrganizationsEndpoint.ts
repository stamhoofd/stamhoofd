import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Organization } from '@stamhoofd/models';
import { Organization as OrganizationStruct } from "@stamhoofd/structures";

import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<OrganizationStruct>
type ResponseBody = OrganizationStruct[]

export class PatchOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(OrganizationStruct as Decoder<OrganizationStruct>, OrganizationStruct.patchType() as Decoder<AutoEncoderPatchType<OrganizationStruct>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/admin/organizations", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()
        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
        }
      
        if (request.body.changes.length == 0) {
            return new Response([]);
        }

        const result: OrganizationStruct[] = [];

        for (const id of request.body.getDeletes()) {
            const organization = await Organization.getByID(id);
            if (!organization) {
                throw new SimpleError({ code: "not_found", message: "Organization not found", statusCode: 404 });
            }

            await organization.delete();
        }

        return new Response(result);
    }
}
