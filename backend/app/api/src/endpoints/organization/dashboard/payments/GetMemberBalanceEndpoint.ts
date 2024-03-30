import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, Group, Member, Token } from "@stamhoofd/models";
import { MemberBalanceItem } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = MemberBalanceItem[]

export class GetMemberBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members/@id/balance", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const member = (await Member.getWithRegistrations(request.params.id))
        const groups = await Group.where({ organizationId: user.organizationId })

        if (! member || member.organizationId != user.organizationId || !member.hasReadAccess(user, groups)) {
            throw new SimpleError({
                code: "not_found",
                message: "No members found",
                human: "Geen leden gevonden, of je hebt geen toegang tot deze leden"
            })
        }

        // Get all balance items for this member or users
        const balanceItems = await BalanceItem.balanceItemsForUsersAndMembers(member.users.map(u => u.id), [member.id])

        return new Response(
            await BalanceItem.getMemberStructure(balanceItems)
        );
    }
}
