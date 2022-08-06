import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { Invite as InviteStruct, OrganizationAdmins, OrganizationSimple,User as UserStruct } from "@stamhoofd/structures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = OrganizationAdmins

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class GetOrganizationAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/admins", {});

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
                message: "Je hebt geen toegang tot dit onderdeel"
            })
        }

        // Get all admins
        const admins = await User.where({ organizationId: user.organizationId, permissions: { sign: "!=", value: null }})
        const invites = await Invite.where({ organizationId: user.organizationId, permissions: { sign: "!=", value: null } })

        // Resolve senders and receivers
        const inviteStructs: InviteStruct[] = []

        for (const i of invites) {
            const receiver = i.receiverId && admins.find(a => a.id === i.receiverId)
            const sender = admins.find(a => a.id === i.senderId)
            if (!sender) {
                // Hmm.... invite has been send by an old administrator (it won't work, since the trade in endpoint checks the permissions of the sender first)
                console.warn("Invite is not valid anymore, deleting it on the fly...")
                await i.delete()
                continue;
            }
            inviteStructs.push(InviteStruct.create(Object.assign({}, i, {
                receiver: receiver ? UserStruct.create({...receiver, hasAccount: receiver.hasAccount()}) : null,
                sender: UserStruct.create({...sender, hasAccount: sender.hasAccount()}),
                organization: OrganizationSimple.create(user.organization)
            })))
        }

        return new Response(OrganizationAdmins.create({
            users: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
            invites: inviteStructs
        }));
    }
}
