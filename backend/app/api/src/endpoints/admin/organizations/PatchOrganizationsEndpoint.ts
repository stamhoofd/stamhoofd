import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Organization, Platform } from '@stamhoofd/models';
import { OrganizationMetaData, Organization as OrganizationStruct } from "@stamhoofd/structures";

import { Context } from '../../../helpers/Context';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Formatter } from '@stamhoofd/utility';

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

        // Bulk tag editing
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

        // Organization creation
        for (const {put} of request.body.getPuts()) {
            if (put.name.length < 4) {
                if (put.name.length == 0) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Should not be empty",
                        human: "Je bent de naam van je organisatie vergeten in te vullen",
                        field: "organization.name"
                    })
                }
    
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Field is too short",
                    human: "Kijk de naam van je organisatie na, deze is te kort. Vul eventueel aan met de gemeente.",
                    field: "organization.name"
                })
            }
    
            const uri = put.uri || Formatter.slug(put.name);
    
            if (uri.length > 100) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Field is too long",
                    human: "De naam van de vereniging is te lang. Probeer de naam wat te verkorten en probeer opnieuw.",
                    field: "organization.name"
                })
            }
            const uriExists = await Organization.getByURI(uri);
    
            if (uriExists) {
                throw new SimpleError({
                    code: "name_taken",
                    message: "An organization with the same name already exists",
                    human: "Er bestaat al een vereniging met dezelfde URI. Pas deze aan zodat deze uniek is, en controleer of deze vereniging niet al bestaat.",
                    field: "name",
                });
            }

            const alreadyExists = await Organization.getByURI(Formatter.slug(put.name));
    
            if (alreadyExists) {
                throw new SimpleError({
                    code: "name_taken",
                    message: "An organization with the same name already exists",
                    human: "Er bestaat al een vereniging met dezelfde naam. Voeg bijvoorbeeld de naam van je gemeente toe.",
                    field: "name",
                });
            }

            const organization = new Organization();
            organization.id = put.id;
            organization.name = put.name;

            organization.uri = put.uri;
            organization.meta = put.meta
            organization.address = put.address

            if (put.privateMeta) {
                organization.privateMeta = put.privateMeta
            }

            try {
                await organization.save();
            } catch (e) {
                console.error(e);
                throw new SimpleError({
                    code: "creating_organization",
                    message: "Something went wrong while creating the organization. Please try again later or contact us.",
                    statusCode: 500
                });
            }

            result.push(organization);
        }

        return new Response(await AuthenticatedStructures.adminOrganizations(result));
    }
}
