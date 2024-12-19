import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { DetailedReceivableBalance, PaymentStatus, ReceivableBalanceType } from '@stamhoofd/structures';

import { BalanceItem, BalanceItemPayment, CachedBalance, Payment } from '@stamhoofd/models';
import { Context } from '../../../../helpers/Context';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { SQL } from '@stamhoofd/sql';

type Params = { id: string; type: ReceivableBalanceType };
type Query = undefined;
type ResponseBody = DetailedReceivableBalance;
type Body = undefined;

export class GetReceivableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/receivable-balances/@type/@id', {
            type: String,
            id: String,
        });

        if (params && Object.values(ReceivableBalanceType).includes(params.type as unknown as ReceivableBalanceType)) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        const balanceItemModels = await CachedBalance.balanceForObjects(organization.id, [request.params.id], request.params.type);
        let paymentModels: Payment[] = [];

        switch (request.params.type) {
            case ReceivableBalanceType.organization: {
                paymentModels = await Payment.select()
                    .where('organizationId', organization.id)
                    .andWhere(
                        SQL.whereNot('status', PaymentStatus.Failed),
                    )
                    .join(
                        SQL.join(BalanceItemPayment.table)
                            .where(SQL.column(BalanceItemPayment.table, 'paymentId'), SQL.column(Payment.table, 'id')),
                    )
                    .join(
                        SQL.join(BalanceItem.table)
                            .where(SQL.column(BalanceItemPayment.table, 'balanceItemId'), SQL.column(BalanceItem.table, 'id')),
                    )
                    .where(SQL.column(BalanceItem.table, 'payingOrganizationId'), request.params.id)
                    .groupBy(SQL.column(Payment.table, 'id'))
                    .fetch();
                break;
            }

            case ReceivableBalanceType.member: {
                paymentModels = await Payment.select()
                    .where('organizationId', organization.id)
                    .join(
                        SQL.join(BalanceItemPayment.table)
                            .where(SQL.column(BalanceItemPayment.table, 'paymentId'), SQL.column(Payment.table, 'id')),
                    )
                    .join(
                        SQL.join(BalanceItem.table)
                            .where(SQL.column(BalanceItemPayment.table, 'balanceItemId'), SQL.column(BalanceItem.table, 'id')),
                    )
                    .where(SQL.column(BalanceItem.table, 'memberId'), request.params.id)
                    .andWhere(
                        SQL.whereNot('status', PaymentStatus.Failed),
                    )
                    .groupBy(SQL.column(Payment.table, 'id'))
                    .fetch();
                break;
            }

            case ReceivableBalanceType.user: {
                paymentModels = await Payment.select()
                    .where('organizationId', organization.id)
                    .join(
                        SQL.join(BalanceItemPayment.table)
                            .where(SQL.column(BalanceItemPayment.table, 'paymentId'), SQL.column(Payment.table, 'id')),
                    )
                    .join(
                        SQL.join(BalanceItem.table)
                            .where(SQL.column(BalanceItemPayment.table, 'balanceItemId'), SQL.column(BalanceItem.table, 'id')),
                    )
                    .where(SQL.column(BalanceItem.table, 'userId'), request.params.id)
                    .andWhere(
                        SQL.whereNot('status', PaymentStatus.Failed),
                    )
                    .groupBy(SQL.column(Payment.table, 'id'))
                    .fetch();
                break;
            }
        }

        const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels);
        const payments = await AuthenticatedStructures.paymentsGeneral(paymentModels, false);

        const balances = await CachedBalance.getForObjects([request.params.id], organization.id);

        const created = new CachedBalance();
        created.amountOpen = 0;
        created.amountPending = 0;
        created.organizationId = organization.id;
        created.objectId = request.params.id;
        created.objectType = request.params.type;

        const base = await AuthenticatedStructures.receivableBalance(balances.length === 1 ? balances[0] : created);

        return new Response(
            DetailedReceivableBalance.create({
                ...base,
                balanceItems,
                payments,
            }),
        );
    }
}
