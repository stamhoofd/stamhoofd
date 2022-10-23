import { Database } from "@simonbackx/simple-database";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { BalanceItem, Member, Token } from "@stamhoofd/models";
import { BalanceItemStatus, MemberBalanceItem } from "@stamhoofd/structures";

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

    static async balanceItemsForUsersAndMembers(userIds: string[], memberIds: string[]): Promise<BalanceItem[]> {
        if (memberIds.length == 0 && userIds.length == 0) {
            return []
        }
        
        const params: any[] = [BalanceItemStatus.Hidden];
        const where: string[] = [];

        if (memberIds.length) {
            where.push(`memberId IN (?)`)
            params.push(memberIds);
        }

        if (userIds.length) {
            where.push('(memberId is null AND userId IN (?))')
            params.push(userIds);
        }
        
        const query = `SELECT ${BalanceItem.getDefaultSelect()} FROM ${BalanceItem.table} WHERE ${BalanceItem.table}.status != ? AND (${where.join(" OR ")})`;

        const [rows] = await Database.select(query, params);
        const balanceItems = BalanceItem.fromRows(rows, BalanceItem.table);
        return balanceItems;
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        const members = await Member.getMembersWithRegistrationForUser(user)

        // Get all balance items for this member or users
        const balanceItems = await GetUserBalanceEndpoint.balanceItemsForUsersAndMembers([user.id], members.map(m => m.id))

        return new Response(
            await BalanceItem.getMemberStructure(balanceItems)
        );
    }
}
