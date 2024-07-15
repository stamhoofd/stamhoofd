import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SQL, SQLAlias, SQLSum, SQLCount, SQLDistinct, SQLSelectAs } from '@stamhoofd/sql';
import { ChargeMembershipsSummary, ChargeMembershipsTypeSummary } from '@stamhoofd/structures';
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
                organizations: organizations ?? 0,
                membershipsPerType: await this.fetchPerType()
            })
        );
    }

    async fetchPerType() {
        const query = SQL
            .select(
                SQL.column('member_platform_memberships', 'membershipTypeId'),
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
            );
        query.where(SQL.column('invoiceId'), null)
        query.andWhere(SQL.column('invoiceItemDetailId'), null)
        query.groupBy(SQL.column('member_platform_memberships', 'membershipTypeId'));


        const result = await query.fetch();
        console.log(result);

        const membershipsPerType = new Map<string, ChargeMembershipsTypeSummary>();

        for (const row of result) {
            membershipsPerType.set(row['member_platform_memberships']['membershipTypeId'] as string, ChargeMembershipsTypeSummary.create({
                memberships: row['data']['memberships'] as number,
                members: row['data']['members'] as number,
                price: row['data']['price'] as number,
                organizations: row['data']['organizations'] as number
            }));
        }

        return membershipsPerType;
    }
}
