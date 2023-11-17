import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token, User } from '@stamhoofd/models';
import { ApiUser } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<ApiUser>
type ResponseBody = ApiUser

export class PatchUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ApiUser.patchType() as Decoder<AutoEncoderPatchType<ApiUser>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/api-keys/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request, {allowWithoutAccount: true});
        const user = token.user

        if (((!user.permissions || !user.hasFullAccess()) && user.id != request.body.id) || request.params.id != request.body.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze API-user te wijzigen"
            })
        }

        const editUser = request.body.id === user.id ? user : await User.getByID(request.body.id)
        if (editUser?.organizationId !== user.organizationId || !editUser.isApiUser) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze API-user te wijzigen"
            })
        }

        editUser.firstName = request.body.name ?? editUser.name
        editUser.lastName = null

        if (request.body.permissions !== undefined && editUser.permissions) {
            if (!user.hasFullAccess()) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen rechten om de rechten van deze API-user te wijzigen"
                })
            }

            if (request.body.permissions) {
                editUser.permissions.patchOrPut(request.body.permissions)
            } else {
                editUser.permissions = null
            }

            if (editUser.id === user.id && (!editUser.permissions || !editUser.permissions.hasFullAccess(user.organization.privateMeta.roles))) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je kan jezelf niet verwijderen als hoofdbeheerder"
                })
            }
        }

        await editUser.save();

        return new Response(await editUser.toApiUserStruct());      
    }
}
