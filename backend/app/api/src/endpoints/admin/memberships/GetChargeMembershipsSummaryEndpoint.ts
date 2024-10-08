import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SQL, SQLAlias, SQLCount, SQLDistinct, SQLSelectAs, SQLSum } from '@stamhoofd/sql';
import { ChargeMembershipsSummary, ChargeMembershipsTypeSummary } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context';
import { QueueHandler } from '@stamhoofd/queues';
import { Platform } from '@stamhoofd/models';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Query = Record<string, never>;
type Body = undefined;
type ResponseBody = ChargeMembershipsSummary;

export class GetChargeMembershipsSummaryEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/charge-memberships/summary', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        if (QueueHandler.isRunning('charge-memberships')) {
            return new Response(
                ChargeMembershipsSummary.create({
                    running: true,
                }),
            );
        }

        const platform = await Platform.getShared();
        const chargeVia = platform.membershipOrganizationId;

        const query = SQL
            .select(
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'id'),
                        ),
                    ),
                    new SQLAlias('data__memberships'),
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'memberId'),
                        ),
                    ),
                    new SQLAlias('data__members'),
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'organizationId'),
                        ),
                    ),
                    new SQLAlias('data__organizations'),
                ),
                new SQLSelectAs(
                    new SQLSum(
                        SQL.column('member_platform_memberships', 'price'),
                    ),
                    new SQLAlias('data__price'),
                ),
            )
            .from('member_platform_memberships')
            .where('balanceItemId', null)
            .where('deletedAt', null)
            .whereNot('organizationId', chargeVia);

        const result = await query.fetch();
        const members = result[0]['data']['members'] as number;
        const memberships = result[0]['data']['memberships'] as number;
        const organizations = result[0]['data']['organizations'] as number;
        const price = result[0]['data']['price'] as number;

        return new Response(
            ChargeMembershipsSummary.create({
                running: false,
                memberships: memberships ?? 0,
                members: members ?? 0,
                price: price ?? 0,
                organizations: organizations ?? 0,
                membershipsPerType: await this.fetchPerType(chargeVia),
            }),
        );
    }

    async fetchPerType(chargeVia: string | null) {
        const query = SQL
            .select(
                SQL.column('member_platform_memberships', 'membershipTypeId'),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'id'),
                        ),
                    ),
                    new SQLAlias('data__memberships'),
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'memberId'),
                        ),
                    ),
                    new SQLAlias('data__members'),
                ),
                new SQLSelectAs(
                    new SQLCount(
                        new SQLDistinct(
                            SQL.column('member_platform_memberships', 'organizationId'),
                        ),
                    ),
                    new SQLAlias('data__organizations'),
                ),
                new SQLSelectAs(
                    new SQLSum(
                        SQL.column('member_platform_memberships', 'price'),
                    ),
                    new SQLAlias('data__price'),
                ),
            )
            .from('member_platform_memberships')
            .where('balanceItemId', null)
            .where('deletedAt', null)
            .whereNot('organizationId', chargeVia)
            .groupBy(
                SQL.column('member_platform_memberships', 'membershipTypeId'),
            );

        const result = await query.fetch();
        const membershipsPerType = new Map<string, ChargeMembershipsTypeSummary>();

        for (const row of result) {
            membershipsPerType.set(row['member_platform_memberships']['membershipTypeId'] as string, ChargeMembershipsTypeSummary.create({
                memberships: row['data']['memberships'] as number,
                members: row['data']['members'] as number,
                price: row['data']['price'] as number,
                organizations: row['data']['organizations'] as number,
            }));
        }

        return membershipsPerType;
    }
}
