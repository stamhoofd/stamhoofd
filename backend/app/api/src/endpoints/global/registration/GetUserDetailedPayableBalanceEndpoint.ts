import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { BalanceItemPayment, Payment } from '@stamhoofd/models';
import { BalanceItem, Member, Organization } from '@stamhoofd/models';
import { DetailedPayableBalanceCollection, DetailedPayableBalance, PaymentStatus } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { SQL, SQLWhereExists } from '@stamhoofd/sql';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = DetailedPayableBalanceCollection;

export class GetUserDetailedPayableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = request.getVersion() >= 339
            ? Endpoint.parseParameters(request.url, '/user/payable-balance/detailed', {})
            : Endpoint.parseParameters(request.url, '/user/billing/status/detailed', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        const memberIds = await Member.getMemberIdsForUser(user);

        const balanceItemModels = await BalanceItem.balanceItemsForUsersAndMembers(organization?.id ?? null, [user.id], memberIds);

        // todo: this is a duplicate query
        const q = Payment.select()
            .where(
                SQL.where('payingUserId', user.id)
                .or(
                    new SQLWhereExists(SQL.subQuery(
                        SQL.select().from('balance_items')
                            .join(SQL.innerJoin(
                                    SQL.table(BalanceItemPayment.table))
                                    .where(
                                        SQL.column(BalanceItemPayment.table, 'balanceItemId'),
                                        SQL.column(BalanceItem.table, 'id'),
                                    )
                            )
                            .where(SQL.where('memberId', memberIds).or('userId', user.id))
                            .where(SQL.column(BalanceItemPayment.table, 'paymentId'), SQL.column(Payment.table, 'id'))
                        )
                    )
                )
            )
            .whereNot('status', PaymentStatus.Failed);

        if (organization) {
            q.where('organizationId', organization.id)
        }

        q.orderBy('createdAt', 'DESC')
        q.limit(100)

        const payments = await q.fetch()

        return new Response(await GetUserDetailedPayableBalanceEndpoint.getDetailedBillingStatus(balanceItemModels, payments));
    }

    static async getDetailedBillingStatus(balanceItemModels: BalanceItem[], paymentModels: Payment[]) {
        const organizationIds = Formatter.uniqueArray([
            ...balanceItemModels.map(b => b.organizationId),
            ...paymentModels.map(p => p.organizationId).filter(p => p !== null),
        ]);

        // Group by organization you'll have to pay to
        if (organizationIds.length === 0) {
            return DetailedPayableBalanceCollection.create({});
        }

        // Optimization: prevent fetching the organization we already have
        const organization = Context.organization;

        let addOrganization = false;
        const i = organization ? organizationIds.indexOf(organization.id) : -1;
        if (i !== -1) {
            organizationIds.splice(i, 1);
            addOrganization = true;
        }

        const organizationModels = await Organization.getByIDs(...organizationIds);

        if (addOrganization && organization) {
            organizationModels.push(organization);
        }

        const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels);
        const organizations = await AuthenticatedStructures.baseOrganizations(organizationModels);
        const payments = await AuthenticatedStructures.payments(paymentModels);

        return DetailedPayableBalanceCollection.create({
            organizations: organizations.map((o) => {
                return DetailedPayableBalance.create({
                    organization: o,
                    balanceItems: balanceItems.filter(b => b.organizationId == o.id),
                    payments: payments.filter(p => p.organizationId === o.id),
                });
            }),
        });
    }
}
