import { AutoEncoderPatchType, Decoder,PatchType } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Invite as InviteStruct, InviteUserDetails,OrganizationSimple,Permissions,User as UserStruct } from "@stamhoofd/structures";

import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<InviteStruct>
type ResponseBody = InviteStruct

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class PatchInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = InviteStruct.patchType() as Decoder<AutoEncoderPatchType<InviteStruct>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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
                message: "Je hebt geen toegang om deze uitnodiging te wijzigen"
            })
        }

        const invite = await Invite.getByID(request.params.id)
        if (invite?.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze uitnodiging te wijzigen"
            })
        }

        if (request.body.userDetails) {
            if (!invite.userDetails) {
                invite.userDetails = InviteUserDetails.create(request.body.userDetails)
            } else {
                invite.userDetails = invite.userDetails.patch(request.body.userDetails)
            }
        }

        if (request.body.permissions) {
            if (request.body.permissions.isPatch()) {
                if (!invite.permissions) {
                    invite.permissions = Permissions.create({}).patch(request.body.permissions)
                } else {
                    invite.permissions = invite.permissions.patch(request.body.permissions)
                }
            } else {
                invite.permissions = request.body.permissions
            }
        }
        
        // todo: add flag if we want to regenerate the invite

        await invite.save();

        const sender = await User.getByID(invite.senderId)
        if (!sender || (invite.permissions && !sender.permissions)) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is niet langer geldig",
                statusCode: 404
            })
        }

        return new Response(InviteStruct.create(Object.assign({}, invite, {
            receiver: token ? UserStruct.create(token.user) : null,
            sender: UserStruct.create(sender),
            organization: OrganizationSimple.create(user.organization)
        })));
    }
}
