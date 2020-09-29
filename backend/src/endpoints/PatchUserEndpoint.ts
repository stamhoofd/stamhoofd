import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Invite as InviteStruct, KeyConstants,NewUser, Permissions, User as UserStruct } from "@stamhoofd/structures";

import { Token } from '../models/Token';
import { User } from '../models/User';
type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<NewUser>
type ResponseBody = UserStruct

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class CreateInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser.patchType() as Decoder<AutoEncoderPatchType<NewUser>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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

        if (((!user.permissions || !user.permissions.hasFullAccess()) && user.id != request.body.id) || request.params.id != request.body.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te wijzigen"
            })
        }

        const editUser = request.body.id === user.id ? user : await User.getByID(request.body.id)
        if (editUser?.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te wijzigen"
            })
        }

        editUser.firstName = request.body.firstName ?? editUser.firstName
        editUser.lastName = request.body.lastName ?? editUser.lastName
        editUser.email = request.body.email ?? editUser.email

        if (request.body.permissions) {
            if (!user.permissions || !user.permissions.hasFullAccess()) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen rechten om de rechten van deze gebruiker te wijzigen"
                })
            }
            editUser.permissions = editUser.permissions ? editUser.permissions.patch(request.body.permissions) : Permissions.create(request.body.permissions)
        }

        if (editUser.id == user.id && request.body.publicAuthSignKey && request.body.authSignKeyConstants && request.body.authEncryptionKeyConstants && request.body.encryptedPrivateKey && request.body.authEncryptionKeyConstants.isPut() && request.body.authSignKeyConstants.isPut()) {
            // password changes
            editUser.changePassword(request.body.publicAuthSignKey, request.body.encryptedPrivateKey, request.body.authSignKeyConstants, request.body.authEncryptionKeyConstants)
        }

        await editUser.save();

        return new Response(UserStruct.create(editUser));      
    }
}
