import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";

import { Group } from '../models/Group';
import { Registration } from '../models/Registration';
import { Token } from '../models/Token';
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = undefined

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class DeleteRegistrationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/registration/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze registratie te verwijderen"
            })
        }

        const registration = await Registration.getByID(request.params.id)
        if (!registration) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze registratie te verwijderen"
            })
        }
        const group = await Group.getByID(registration.groupId)
        if (!group || group.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze registratie te verwijderen"
            })
        }
        
        await registration.delete();
        return new Response(undefined);      
    }
}
