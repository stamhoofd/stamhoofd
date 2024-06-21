import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Organization, Platform } from '@stamhoofd/models';
import { OrganizationMetaData, Organization as OrganizationStruct } from "@stamhoofd/structures";

import { Context } from '../../../helpers/Context';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';

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

        const result: Organization[] = [];
        const platform = await Platform.getShared()

        for (const id of request.body.getDeletes()) {
            const organization = await Organization.getByID(id);
            if (!organization) {
                throw new SimpleError({ code: "not_found", message: "Organization not found", statusCode: 404 });
            }

            await organization.delete();
        }

        for (const patch of request.body.getPatches()) {
            const organization = await Organization.getByID(patch.id);
            if (!organization) {
                throw new SimpleError({ code: "not_found", message: "Organization not found", statusCode: 404 });
            }

            if (patch.meta?.tags) {
                const cleanedPatch = OrganizationMetaData.patch({
                    tags: patch.meta.tags as any
                })
                const patchedMeta = organization.meta.patch(cleanedPatch);
                for (const tag of patchedMeta.tags) {
                    if (!platform.config.tags.find(t => t.id === tag)) {
                        throw new SimpleError({ code: "invalid_tag", message: "Invalid tag", statusCode: 400 });
                    }
                }

                // Sort tags based on platform config order
                patchedMeta.tags.sort((a, b) => {
                    const aIndex = platform.config.tags.findIndex(t => t.id === a);
                    const bIndex = platform.config.tags.findIndex(t => t.id === b);
                    return aIndex - bIndex;
                })

                organization.meta.tags = patchedMeta.tags;
            }

            await organization.save();
            result.push(organization);
        }

        return new Response(await AuthenticatedStructures.adminOrganizations(result));
    }
}
