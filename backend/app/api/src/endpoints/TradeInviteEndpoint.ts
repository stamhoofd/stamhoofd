import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { GroupPermissions,OrganizationSimple, PermissionLevel,Permissions, TradedInvite, User as UserStruct } from "@stamhoofd/structures";

import { Invite } from '../models/Invite';
import { Organization } from '../models/Organization';
import { Token, TokenWithUser } from '../models/Token';
import { User } from '../models/User';
type Params = { key: string };
type Query = undefined;
type Body = undefined
type ResponseBody = TradedInvite // encrypted keychain items or null

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class TradeInviteEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/invite/@key/trade", { key: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user
        const invites = await Invite.where({ key: decodeURIComponent(request.params.key), organizationId: user.organization.id }, { limit: 1 })

        if (invites.length != 1) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is ongeldig of is vervallen",
                statusCode: 404
            })
        }

        const [invite] = invites

        if (invite.validUntil < new Date() || invite.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "expired",
                message: "This invite is expired",
                human: "Deze link is niet langer geldig, vraag om deze opnieuw te versturen",
                statusCode: 400
            })
        }

        if (invite.userDetails?.email && (user.email !== invite.userDetails.email || !user.verified)) {
            throw new SimpleError({
                code: "invalid_email",
                message: "This invite is only intended for an account with email "+invite.userDetails.email,
                human: "Je kan deze uitnodiging enkel accepteren op het account met e-mailadres "+invite.userDetails.email+". Vraag een nieuwe uitnodiging.",
                statusCode: 400
            })
        }

        if (invite.receiverId) {

            if (invite.receiverId != token.user.id) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Not authorized for this invitation",
                    human: "Deze link is niet gedeeld met jouw account, kijk na of je wel met het juiste account bent ingelogd",
                    statusCode: 403
                })
            }
        }

        const sender = await User.getByID(invite.senderId)
        if (!sender || (invite.permissions && !sender.permissions)) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is niet langer geldig omdat hij is aangemaakt door een beheerder die geen toegang meer heeft",
                statusCode: 404
            })
        }
      

        if (invite.permissions) {
            if (!user.permissions) {
                user.permissions = Permissions.create({ level: PermissionLevel.None })
            }

            // Check invites of old administrators
            if (!sender.permissions!.hasFullAccess()) {
                throw new SimpleError({
                    code: "not_found",
                    message: "This invite is invalid or expired",
                    human: "Deze link is niet langer geldig omdat hij aangemaakt is door een beheerder die zelf geen toegang meer heeft",
                    statusCode: 404
                })
            }

            user.permissions.roles = invite.permissions.roles

            await user.save();
        }
       
        // Delete invite
        await invite.delete()
        return new Response(TradedInvite.create(Object.assign({}, invite, {
            receiver: token ? UserStruct.create(token.user) : null,
            sender: UserStruct.create(sender),
            organization: OrganizationSimple.create(user.organization)
        })));
    }
}
