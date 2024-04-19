import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { User } from '@stamhoofd/models';

import { Context } from "../../../../helpers/Context";
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = undefined

export class DeleteUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }

        const params2 = Endpoint.parseParameters(request.url, "/api-keys/@id", { id: String });

        if (params2) {
            return [true, params2 as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManageAdmins()) {
            throw Context.auth.error()
        }

        if (user.id == request.params.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je kan jezelf niet verwijderen"
            })
        }

        const editUser = await User.getByID(request.params.id)
        if (!editUser || !Context.auth.checkScope(editUser.organizationId)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te verwijderen"
            })
        }
        
        await editUser.delete();

        return new Response(undefined);      
    }
}
