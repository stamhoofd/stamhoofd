import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EmailVerificationCode, Organization } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { NewUser, Permissions, User as UserStruct } from "@stamhoofd/structures";

import { AdminToken } from '../../models/AdminToken';

type Params = { id: string };
type Query = undefined;
type Body = PatchableArrayAutoEncoder<NewUser>
type ResponseBody = undefined

export class PatchOrganizationUsersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(NewUser as Decoder<NewUser>, NewUser.patchType() as Decoder<AutoEncoderPatchType<NewUser>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/@id/users", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
       
        const organization = await Organization.getByID(request.params.id)
        if (!organization) {
            throw new SimpleError({
                code: "not_found",
                message: "Organization not found",
                statusCode: 404
            })
        }

        for (const put of request.body.getPuts()) {
            const struct = put.put

            // Create a new user
            const user = await User.register(organization, struct)
            if (user) {
                user.permissions = struct.permissions
                await user.save()
            }
        }

        for (const patch of request.body.getPatches()) {
            const editUser = await User.getByID(patch.id)
            if (!editUser || editUser?.organizationId !== organization.id) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen toegang om deze gebruiker te wijzigen"
                })
            }

            editUser.firstName = patch.firstName ?? editUser.firstName
            editUser.lastName = patch.lastName ?? editUser.lastName

            if (patch.permissions) {
                if (!editUser.permissions) {
                    editUser.permissions = Permissions.create({})
                }
                editUser.permissions?.patchOrPut(patch.permissions)
            }

            if (patch.password) {
                // password changes
                await editUser.changePassword(patch.password)
            }

            await editUser.save()

            if (patch.email && patch.email !== editUser.email) {
                throw new Error("Editing e-mail not yet supported")
            }

        }

        for (const id of request.body.getDeletes()) {
            const editUser = await User.getByID(id)
            if (!editUser || editUser?.organizationId !== organization.id) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen toegang om deze gebruiker te wijzigen"
                })
            }
            await editUser.delete()
        }

        return new Response(undefined);      
    }
}
