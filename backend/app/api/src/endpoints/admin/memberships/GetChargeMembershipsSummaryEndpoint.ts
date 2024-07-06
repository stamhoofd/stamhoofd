import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SQL, SQLAlias, SQLSum, SQLCount, SQLDistinct, SQLSelectAs } from '@stamhoofd/sql';
import { ChargeMembershipsSummary } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context';


type Params = Record<string, never>;
type Query = Record<string, never>;
type Body = undefined;
type ResponseBody = ChargeMembershipsSummary;

export class GetChargeMembershipsSummaryEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/admin/charge-memberships/summary", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
        }
        
        const query = SQL
            .select(
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'id')
                        )
                    ),
                    new SQLAlias('data__memberships')
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'memberId')
                        )
                    ),
                    new SQLAlias('data__members')
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'organizationId')
                        )
                    ),
                    new SQLAlias('data__organizations')
                ),
                new SQLSelectAs(
                    new SQLSum(
                        SQL.column('member_platform_memberships', 'price')
                    ),
                    new SQLAlias('data__price')
                )
            )
            .from(
                SQL.table('member_platform_memberships')
            )
            .where(SQL.column('invoiceId'), null)
            .andWhere(SQL.column('invoiceItemDetailId'), null);


        const result = await query.fetch();
        const members = result[0]['data']['members'] as number;
        const memberships = result[0]['data']['memberships'] as number;
        const organizations = result[0]['data']['organizations'] as number;
        const price = result[0]['data']['price'] as number;

        return new Response(
            ChargeMembershipsSummary.create({
                memberships: memberships ?? 0,
                members: members ?? 0,
                price: price ?? 0,
                organizations: organizations ?? 0
            })
        );
    }
}
