import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { DetailedReceivableBalance, PaymentStatus, PermissionLevel, ReceivableBalanceType } from '@stamhoofd/structures';

import type { MemberWithUsersAndRegistrations } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, CachedBalance, Invoice, InvoicedBalanceItem, Member, MemberUser, Payment, Registration } from '@stamhoofd/models';
import { Context } from '../../../../helpers/Context.js';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import type { SQLWhere } from '@stamhoofd/sql';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemService } from '../../../../services/BalanceItemService.js';
import { Formatter, Sorter } from '@stamhoofd/utility';

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

        if (!await Context.auth.canManageFinances(organization.id)) {
            let member: MemberWithUsersAndRegistrations | null = null;
            if (request.params.type === ReceivableBalanceType.registration) {
                const registration = await Registration.select().where('id', request.params.id).first(false);
                if (!registration) throw Context.auth.error();
                member = await Member.getByIdWithUsersAndRegistrations(registration.memberId);
            } else if (request.params.type === ReceivableBalanceType.member) {
                member = await Member.getByIdWithUsersAndRegistrations(request.params.id);
                if (!member || !await Context.auth.hasFinancialMemberAccess(member, PermissionLevel.Read, organization.id)) {
                    throw Context.auth.error();
                }
            }
            if (!member || !await Context.auth.hasFinancialMemberAccess(member, PermissionLevel.Read, organization.id)) {
                throw Context.auth.error();
            }
        }

        // Note: the cache updates are disabled because they caused performance issues
        // BalanceItemService.scheduleOrganizationUpdate / scheduleMemberUpdate / scheduleUserUpdate

        const balanceItemWhere = await GetReceivableBalanceEndpoint.getBalanceItemWhere(request.params.type, request.params.id);

        const paymentModels = await Payment.select()
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
            .andWhere(balanceItemWhere)
            .groupBy(SQL.column(Payment.table, 'id'))
            .fetch();

        const invoiceModels = await GetReceivableBalanceEndpoint.getInvoices(organization.id, request.params.type, request.params.id, balanceItemWhere);

        // Flush caches (this makes sure that we do a reload in the frontend after a registration or change, we get the newest balances)
        // await BalanceItemService.flushCaches(organization.id);
        const balanceItemModels = await CachedBalance.balanceForObjects(organization.id, [request.params.id], request.params.type);
        const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels);
        const payments = await AuthenticatedStructures.paymentsGeneral(paymentModels, false);
        const invoices = await AuthenticatedStructures.invoices(invoiceModels);

        const balances = await CachedBalance.getForObjects([request.params.id], organization.id, request.params.type);

        const created = new CachedBalance();
        created.amountOpen = 0;
        created.amountPending = 0;
        created.amountPaid = 0;
        created.organizationId = organization.id;
        created.objectId = request.params.id;
        created.objectType = request.params.type;

        const base = await AuthenticatedStructures.receivableBalance(balances.length === 1 ? balances[0] : created);

        return new Response(
            DetailedReceivableBalance.create({
                ...base,
                balanceItems,
                payments,
                invoices,
            }),
        );
    }

    /**
     * Builds the condition that matches all balance items that belong to this receivable balance.
     * Requires the balance_items table to be joined in the query.
     */
    private static async getBalanceItemWhere(type: ReceivableBalanceType, id: string): Promise<SQLWhere> {
        switch (type) {
            case ReceivableBalanceType.organization:
                return SQL.where(SQL.column(BalanceItem.table, 'payingOrganizationId'), id);

            case ReceivableBalanceType.member:
                return SQL.where(SQL.column(BalanceItem.table, 'memberId'), id);

            case ReceivableBalanceType.user: {
                const memberUsers = await MemberUser.select().where('usersId', id).fetch();
                const memberIds = Formatter.uniqueArray(memberUsers.map(mu => mu.membersId));

                if (memberIds.length === 0) {
                    return SQL.where(SQL.column(BalanceItem.table, 'userId'), id);
                }
                return SQL.where(SQL.column(BalanceItem.table, 'userId'), id)
                    .or(SQL.column(BalanceItem.table, 'memberId'), memberIds);
            }

            case ReceivableBalanceType.userWithoutMembers:
                return SQL.where(SQL.column(BalanceItem.table, 'userId'), id);

            case ReceivableBalanceType.registration:
                return SQL.where(SQL.column(BalanceItem.table, 'registrationId'), id);
        }
    }

    /**
     * All invoices that are related to this receivable balance: invoices that invoiced one of the
     * balance items of this receivable balance, and for organizations also invoices that are
     * directly addressed to the paying organization.
     */
    private static async getInvoices(organizationId: string, type: ReceivableBalanceType, id: string, balanceItemWhere: SQLWhere): Promise<Invoice[]> {
        const invoiceModels = await Invoice.select()
            .where('organizationId', organizationId)
            .join(
                SQL.join(InvoicedBalanceItem.table)
                    .where(SQL.column(InvoicedBalanceItem.table, 'invoiceId'), SQL.column(Invoice.table, 'id')),
            )
            .join(
                SQL.join(BalanceItem.table)
                    .where(SQL.column(InvoicedBalanceItem.table, 'balanceItemId'), SQL.column(BalanceItem.table, 'id')),
            )
            .andWhere(balanceItemWhere)
            .groupBy(SQL.column(Invoice.table, 'id'))
            .fetch();

        if (type === ReceivableBalanceType.organization) {
            const directInvoices = await Invoice.select()
                .where('organizationId', organizationId)
                .where('payingOrganizationId', id)
                .fetch();

            for (const invoice of directInvoices) {
                if (!invoiceModels.some(i => i.id === invoice.id)) {
                    invoiceModels.push(invoice);
                }
            }
        }

        // Oldest first
        invoiceModels.sort((a, b) => Sorter.byDateValue(b.invoicedAt ?? b.createdAt, a.invoicedAt ?? a.createdAt));
        return invoiceModels;
    }
}
