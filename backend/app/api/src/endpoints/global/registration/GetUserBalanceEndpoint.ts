import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { BalanceItem, Member } from "@stamhoofd/models";
import { MemberBalanceItem } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined
type Body = undefined
type ResponseBody = MemberBalanceItem[]

export class GetUserBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/balance", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        const {user} = await Context.authenticate()

        const members = await Member.getMembersWithRegistrationForUser(user)

        // Get all balance items for this member or users
        const balanceItems = await BalanceItem.balanceItemsForUsersAndMembers([user.id], members.map(m => m.id))

        return new Response(
            await BalanceItem.getMemberStructure(balanceItems)
        );
    }
}
