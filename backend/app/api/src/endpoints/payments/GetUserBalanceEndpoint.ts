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
        
        const params: any[] = [];
        const where: string[] = [];

        if (memberIds.length) {
            if (memberIds.length == 1) {
                where.push(`memberId = ?`)
                params.push(memberIds[0]);
            } else {
                where.push(`memberId IN (?)`)
                params.push(memberIds);
            }
        }

        // Note here, we don't search for memberId IS NULL restriction in MySQL because it slows down the query too much (500ms)
        // Better if we do it in code here
        if (userIds.length) {
            if (userIds.length == 1) {
                where.push('userId = ?')
                params.push(userIds[0]);
            } else {
                where.push('userId IN (?)')
                params.push(userIds);
            }
        }
        
        const query = `SELECT ${BalanceItem.getDefaultSelect()} FROM ${BalanceItem.table} WHERE (${where.join(" OR ")}) AND ${BalanceItem.table}.status != ?`;
        params.push(BalanceItemStatus.Hidden);
        
        const [rows] = await Database.select(query, params);
        const balanceItems = BalanceItem.fromRows(rows, BalanceItem.table);

        // Filter out items of other members
        if (memberIds.length) {
            return balanceItems.filter(b => !b.memberId || memberIds.includes(b.memberId))
        }
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
