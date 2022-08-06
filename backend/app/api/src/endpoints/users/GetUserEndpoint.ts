import { Database } from '@simonbackx/simple-database';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Invite } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { User } from '@stamhoofd/models';
import { MyUser, OrganizationSimple, TradedInvite, User as UserStruct } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MyUser;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request, {allowWithoutAccount: true});

        // Get user unrestriced
        const user = await User.getFull(token.user.id)

        if (!user) {
            throw new Error("Unexpected error")
        }

        // Search incoming invites that are valid
        let invites = await Invite.where({ receiverId: user.id, organizationId: user.organizationId }, { limit: 20 })
        const d = new Date()
        d.setTime(d.getTime() - 60*1000) // 1 minute timespan
        const deleteInvites = invites.filter(i => i.validUntil < d).map(i => i.id)
        if (deleteInvites.length > 0) {
            Database.delete("delete from `"+Invite.table+"` where id IN (?)", [deleteInvites]).catch(e => {
                // No need to wait to delete these invites before returning a response
                console.error(e)
            })
            invites = invites.filter(i => i.validUntil >= d)
        }
        const loadedInvites = await Invite.sender.load(invites)

        const st = MyUser.create({
            firstName: user.firstName,
            lastName: user.lastName,
            id: user.id,
            email: user.email,
            verified: user.verified,
            permissions: user.permissions,
            hasAccount: user.hasAccount(),
            incomingInvites: loadedInvites.map(invite => TradedInvite.create(
                TradedInvite.create(Object.assign({}, invite, {
                    receiver: UserStruct.create({...user, hasAccount: user.hasAccount()}),
                    sender: UserStruct.create({...invite.sender, hasAccount: invite.sender.hasAccount()}),
                    organization: OrganizationSimple.create(token.user.organization)
                })))
            )
        })
        return new Response(st);
    }
}
