import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";

import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class DeleteInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/invite/@id", { id: String });

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
                message: "Je hebt geen toegang om deze uitnodiging te verwijderen"
            })
        }

        const invite = await Invite.getByID(request.params.id)
        if (invite?.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze uitnodiging te verwijderen"
            })
        }

        await invite.delete();

        return new Response(undefined);
    }
}
