import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { BalanceItem, Member } from '@stamhoofd/models';
import { BalanceItemWithPayments } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = BalanceItemWithPayments[];

// Rename to ReceiveableBalance
export class GetMemberBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/members/@id/balance', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const member = (await Member.getWithRegistrations(request.params.id));

        if (!member || !await Context.auth.hasFinancialMemberAccess(member)) {
            throw Context.auth.notFoundOrNoAccess($t(`Geen lid gevonden, of je hebt geen toegang tot dit lid`));
        }

        // Get all balance items for this member or users
        const balanceItems = await BalanceItem.balanceItemsForUsersAndMembers(organization.id, member.users.map(u => u.id), [member.id]);

        return new Response(
            await BalanceItem.getStructureWithPayments(balanceItems),
        );
    }
}
