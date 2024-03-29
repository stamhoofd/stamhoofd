import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { PermissionLevel, PrivateWebshop, Webshop as WebshopStruct } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = PrivateWebshop | WebshopStruct;


export class GetWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.optionalAuthenticate(request);
        const errors = new SimpleErrors()

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "Deze webshop bestaat niet (meer)"
            })
        }
        
        errors.throwIfNotEmpty()

        if (
            token 
            && token.user.permissions 
            && token.user.organizationId == webshop.organizationId 
            && (
                webshop.privateMeta.permissions.userHasAccess(token.user, PermissionLevel.Read)
                || webshop.privateMeta.scanPermissions.userHasAccess(token.user, PermissionLevel.Read)
            )
        ) {
            return new Response(PrivateWebshop.create(webshop));
        }
        return new Response(WebshopStruct.create(webshop));
    }
}
