import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Invite as InviteStruct, NewInvite, User as UserStruct } from "@stamhoofd/structures";

import { Invite } from '../models/Invite';
import { Organization } from '../models/Organization';
import { Token, TokenWithUser } from '../models/Token';
import { User } from '../models/User';
type Params = { key: string };
type Query = undefined;
type Body = undefined
type ResponseBody = string | undefined // encrypted keychain items or null

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
        const organization = await Organization.fromApiHost(request.host);
        const invites = await Invite.where({ key: decodeURIComponent(request.params.key), organizationId: organization.id }, { limit: 1 })

        if (invites.length != 1) {
            throw new SimpleError({
                code: "not_found",
                message: "This invite is invalid or expired",
                human: "Deze link is ongeldig of is vervallen",
                statusCode: 404
            })
        }

        const [invite] = invites

        let token: TokenWithUser | null = null
        if (invite.receiverId) {
            token = await Token.authenticate(request);

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
                human: "Deze link is niet langer geldig",
                statusCode: 404
            })
        }

        const keychainItems = invite.keychainItems

        // Delete invite
        await invite.delete()
        return new Response(keychainItems ?? undefined);
    }
}
