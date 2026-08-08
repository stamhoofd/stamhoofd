import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItemPayment, Payment } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQL } from '@stamhoofd/sql';
import type { IPaginatedResponse, LimitedFilteredRequest } from '@stamhoofd/structures';
import { assertSort, ExcelExportType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';
import { Context } from '../helpers/Context.js';
import { getNextPageRequest } from '../helpers/getNextPageRequest.js';
import { balanceItemPaymentRootFilterCompilers } from '../sql-filters/balance-item-payments-root.js';
import { getPaymentSearchFilter } from '../sql-filters/payments.js';
import { balanceItemPaymentSorters } from '../sql-sorters/balance-item-payments.js';
import type { PaymentWithItem } from './payments.js';
import { createExportBalanceItemPayment, getBalanceItemPaymentColumns, getExportOrder, loadPaymentExportOrders, PaymentGeneralWithStripeAccount } from './payments.js';

const sorters = balanceItemPaymentSorters;
const filterCompilers = balanceItemPaymentRootFilterCompilers;

/**
 * What one payment paid for one balance item, as a row of its own.
 *
 * Money that is spread over several payments, or that paid for several things at once, only exists at
 * this level: a breakdown that adds up parts of payments or of balance items selects them here, so the
 * file holds exactly what was added up instead of the whole payments around it.
 *
 * A webshop order is not split into the articles that were ordered here, the way the payments export
 * does: a row is one balance item payment, which is the unit that was counted.
 */
ExportToExcelEndpoint.loaders.set(ExcelExportType.BalanceItemPayments, {
    fetch: async (requestQuery: LimitedFilteredRequest) => {
        const balanceItemPayments = await fetchPage(requestQuery);

        const response: IPaginatedResponse<PaymentWithItem[], LimitedFilteredRequest> = {
            results: await toRows(balanceItemPayments),
            next: getNextPageRequest(balanceItemPayments, requestQuery, sorters),
        };

        return response;
    },
    getSheets: () => [
        {
            id: 'balanceItemPayments',
            name: $t(`%Ly`),
            columns: getBalanceItemPaymentColumns(),
        },
    ],
});

/**
 * Reads one page of balance item payments, joined to both parents so a filter can reach either of them.
 */
async function fetchPage(requestQuery: LimitedFilteredRequest): Promise<BalanceItemPayment[]> {
    const organization = Context.organization;

    if (!organization) {
        throw Context.auth.error();
    }

    if (!await Context.auth.canManagePayments(organization.id)) {
        throw Context.auth.error();
    }

    const query = BalanceItemPayment.select()
        .setMaxExecutionTime(15 * 1000)
        .join(
            SQL.join(SQL.table('payments')).where(
                SQL.column('payments', 'id'),
                SQL.column('balance_item_payments', 'paymentId'),
            ),
        )
        .join(
            SQL.join(SQL.table('balance_items')).where(
                SQL.column('balance_items', 'id'),
                SQL.column('balance_item_payments', 'balanceItemId'),
            ),
        );

    query.where(await compileToSQLFilter({ organizationId: organization.id }, filterCompilers));

    if (requestQuery.filter) {
        query.where(await compileToSQLFilter(requestQuery.filter, filterCompilers));
    }

    if (requestQuery.search) {
        // Searching selects the same payments as the list this export started from, but a row here is
        // one balance item payment, so the filter has to reach the payment it belongs to
        query.where(await compileToSQLFilter({ payment: getPaymentSearchFilter(requestQuery.search) }, filterCompilers));
    }

    if (requestQuery.pageFilter) {
        query.where(await compileToSQLFilter(requestQuery.pageFilter, filterCompilers));
    }

    requestQuery.sort = assertSort(requestQuery.sort, [{ key: 'id' }]);
    applySQLSorter(query, requestQuery.sort, sorters);
    query.limit(requestQuery.limit);

    try {
        return await query.fetch();
    }
    catch (error) {
        if (error.message.includes('ER_QUERY_TIMEOUT')) {
            throw new SimpleError({
                code: 'timeout',
                message: 'Query took too long',
                human: $t(`%Cv`),
            });
        }
        throw error;
    }
}

/**
 * Pairs every balance item payment with the payment it came in with, keeping the order of the page so
 * the next page picks up where this one stopped.
 */
async function toRows(balanceItemPayments: BalanceItemPayment[]): Promise<PaymentWithItem[]> {
    if (balanceItemPayments.length === 0) {
        return [];
    }

    const paymentIds = Formatter.uniqueArray(balanceItemPayments.map(p => p.paymentId));
    const payments = await AuthenticatedStructures.paymentsGeneral(await Payment.getByIDs(...paymentIds), true);

    // One payment can pay for many rows, so it is only built once even though every row repeats it
    const paymentsById = new Map<string, PaymentGeneralWithStripeAccount>(
        payments.map(payment => [payment.id, PaymentGeneralWithStripeAccount.create(payment)]),
    );

    const rows = balanceItemPayments.flatMap((balanceItemPayment) => {
        const payment = paymentsById.get(balanceItemPayment.paymentId);
        const detailed = payment?.balanceItemPayments.find(p => p.id === balanceItemPayment.id);

        if (!payment || !detailed) {
            // The payment was removed while the file was being written
            return [];
        }

        return [{ payment, detailed }];
    });

    // A row that paid for a webshop order reports the number of that order, which the balance item only
    // holds the id of
    const orderMap = await loadPaymentExportOrders(rows.map(row => row.detailed.balanceItem));

    return rows.map(({ payment, detailed }) => ({
        payment,
        balanceItemPayment: createExportBalanceItemPayment(detailed, null, getExportOrder(detailed, orderMap)),
    }));
}
