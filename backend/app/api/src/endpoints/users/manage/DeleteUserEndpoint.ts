import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token, User } from '@stamhoofd/models';
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
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if ((!user.permissions || !user.hasFullAccess()) || user.id == request.params.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te verwijderen"
            })
        }

        const editUser = await User.getByID(request.params.id)
        if (editUser?.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te verwijderen"
            })
        }

         if (editUser.id === user.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je kan jezelf niet verwijderen"
            })
        }

        await editUser.delete();

        return new Response(undefined);      
    }
}
