import { AutoEncoderPatchType,Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { PermissionLevel, PrivateWebshop } from "@stamhoofd/structures";

import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<PrivateWebshop>;
type ResponseBody = PrivateWebshop;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PrivateWebshop.patchType() as Decoder<AutoEncoderPatchType<PrivateWebshop>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const errors = new SimpleErrors()

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || webshop.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "De webshop die je wilt aanpassen bestaat niet (meer)"
            })
        }

        if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        // Do all updates
        if (request.body.meta) {
            webshop.meta.patchOrPut(request.body.meta)
        }

        if (request.body.privateMeta) {
            webshop.privateMeta.patchOrPut(request.body.privateMeta)
        }

        if (request.body.products) {
            webshop.products = request.body.products.applyTo(webshop.products)
        }

        if (request.body.categories) {
            webshop.categories = request.body.categories.applyTo(webshop.categories)
        }

        if (request.body.domain !== undefined) {
            webshop.domain = request.body.domain
        }

        if (request.body.domainUri !== undefined) {
            webshop.domainUri = request.body.domainUri
        }

        if (request.body.uri !== undefined) {
            webshop.uri = request.body.uri
        }

        // Verify if we have full access
        if (webshop.privateMeta.permissions.getPermissionLevel(user.permissions) !== PermissionLevel.Full) {
            throw new SimpleError({
                code: "missing_permissions",
                message: "You cannot restrict your own permissions",
                human: "Je kan je eigen volledige toegang tot deze webshop niet verwijderen (algemeen > toegangsbeheer). Vraag aan een hoofdbeheerder om jouw toegang te verwijderen."
            })
        }

        await webshop.save()
        
        errors.throwIfNotEmpty()
        return new Response(PrivateWebshop.create(webshop));
    }
}
