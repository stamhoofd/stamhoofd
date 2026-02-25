import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL, SQLAlias, SQLCount, SQLDistinct, SQLSelectAs, SQLSum, SQLWhereSign } from '@stamhoofd/sql';
import { ChargeMembershipsSummary, ChargeMembershipsTypeSummary } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';

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

        const total = await this.fetchTotal(chargeVia, false);
        const totalTrials = await this.fetchTotal(chargeVia, true);

        return new Response(
            ChargeMembershipsSummary.create({
                running: false,
                memberships: total.memberships ?? 0,
                members: total.members ?? 0,
                price: total.price ?? 0,
                organizations: total.organizations ?? 0,
                membershipsPerType: await this.fetchPerType(chargeVia),
                trials: ChargeMembershipsTypeSummary.create({
                    memberships: totalTrials.memberships ?? 0,
                    members: totalTrials.members ?? 0,
                    price: totalTrials.price ?? 0,
                    organizations: totalTrials.organizations ?? 0,
                }),
            }),
        );
    }

    async fetchTotal(chargeVia: string | null, trial = false) {
        const noTrial = SQL.where('trialUntil', null).or('trialUntil', SQLWhereSign.LessEqual, new Date());
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
            .where('locked', false)
            .whereNot('organizationId', chargeVia);

        if (!trial) {
            query.where(noTrial);
        }
        else {
            query.whereNot(noTrial);
        }

        const result = await query.fetch();
        const members = result[0]['data']['members'] as number;
        const memberships = result[0]['data']['memberships'] as number;
        const organizations = result[0]['data']['organizations'] as number;
        const price = result[0]['data']['price'] as number;

        return {
            members,
            memberships,
            organizations,
            price,
        };
    }

    async fetchPerType(chargeVia: string | null, trial = false) {
        const trialQ = SQL.where('trialUntil', null).or('trialUntil', SQLWhereSign.LessEqual, new Date());
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
            .where('locked', false)
            .where(trialQ)
            .whereNot('organizationId', chargeVia)
            .groupBy(
                SQL.column('member_platform_memberships', 'membershipTypeId'),
            );

        if (!trial) {
            query.where(trialQ);
        }
        else {
            query.whereNot(trialQ);
        }

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
