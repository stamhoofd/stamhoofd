import type { XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { BalanceItem, Organization, Webshop } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, OrderFactory, OrganizationFactory, Payment, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { BalanceItemType, ExcelExportType, LimitedFilteredRequest, OrderStatus, PaymentMethod, PaymentStatus, PaymentType, PermissionLevel, Permissions, Platform, SortItemDirection } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { ContextInstance } from '../helpers/Context.js';
import './balance-item-payments.js';
import type { PaymentGeneralWithStripeAccount, PaymentWithItem } from './payments.js';
import './payments.js';

describe('ExcelLoader.Payments order numbers', () => {
    let organization: Organization;
    let webshop: Webshop;

    const paymentsLoader = () => ExportToExcelEndpoint.loaders.get(ExcelExportType.Payments)!;
    const balanceItemPaymentsLoader = () => ExportToExcelEndpoint.loaders.get(ExcelExportType.BalanceItemPayments)!;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();
        webshop = await new WebshopFactory({ organizationId: organization.id }).create();
    });

    async function createOrderBalanceItem(options: { number: number; status?: OrderStatus }) {
        const order = await new OrderFactory({ webshop, number: options.number, status: options.status }).create();
        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            orderId: order.id,
            type: BalanceItemType.Order,
            amount: 1,
            unitPrice: 10_00,
            pricePaid: 10_00,
        }).create();
        return { order, balanceItem };
    }

    async function createPayment(balanceItems: BalanceItem[]) {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = balanceItems.reduce((total, item) => total + item.price, 0);
        payment.paidAt = new Date();
        await payment.save();

        for (const balanceItem of balanceItems) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = balanceItem.price;
            await balanceItemPayment.save();
        }

        return payment;
    }

    function getColumn<T>(columns: XlsxTransformerColumn<T>[], columnId: string) {
        const column = columns.find(c => isXlsxTransformerConcreteColumn(c) && c.id === columnId);
        if (!column || !isXlsxTransformerConcreteColumn(column)) {
            throw new Error('Column ' + columnId + ' not found');
        }
        return column;
    }

    async function fetchAsAdmin<T>(fetch: () => Promise<T>) {
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        return await ContextInstance.startForUser(admin, organization, fetch);
    }

    test('names the orders a payment paid for on both sheets', async () => {
        const live = await createOrderBalanceItem({ number: 123 });
        const deleted = await createOrderBalanceItem({ number: 1638492047163, status: OrderStatus.Deleted });
        const other = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 5_00,
            pricePaid: 5_00,
        }).create();

        const livePayment = await createPayment([live.balanceItem, other]);
        const deletedPayment = await createPayment([deleted.balanceItem]);

        const request = new LimitedFilteredRequest({
            limit: 10,
            sort: [{ key: 'createdAt', order: SortItemDirection.ASC }, { key: 'id', order: SortItemDirection.ASC }],
        });

        const response = await fetchAsAdmin(() => paymentsLoader().fetch(request));
        const results = response.results as PaymentGeneralWithStripeAccount[];
        const sheets = paymentsLoader().getSheets(Platform.create({}));
        const paymentSheet = sheets[0];
        const rowSheet = sheets[1];

        const byId = new Map(results.map(payment => [payment.id, payment]));
        const orderNumbers = getColumn<PaymentGeneralWithStripeAccount>(paymentSheet.columns, 'orderNumbers');
        expect(orderNumbers.getValue(byId.get(livePayment.id)!).value).toBe(123);
        expect(orderNumbers.getValue(byId.get(deletedPayment.id)!).value).toBe('Verwijderd');

        const orderNumber = getColumn<PaymentWithItem>(rowSheet.columns, 'orderNumber');
        const liveRows = rowSheet.transform!(byId.get(livePayment.id)!) as PaymentWithItem[];
        const liveValues = liveRows.map(row => orderNumber.getValue(row).value);
        expect(liveValues).toHaveLength(2);
        expect(liveValues).toEqual(expect.arrayContaining(['', 123]));

        const deletedRows = rowSheet.transform!(byId.get(deletedPayment.id)!) as PaymentWithItem[];
        expect(deletedRows.map(row => orderNumber.getValue(row).value)).toEqual(['Verwijderd']);
    });

    test('names the order of a balance item payment row', async () => {
        const live = await createOrderBalanceItem({ number: 123 });
        const deleted = await createOrderBalanceItem({ number: 1638492047163, status: OrderStatus.Deleted });
        await createPayment([live.balanceItem, deleted.balanceItem]);

        const request = new LimitedFilteredRequest({
            limit: 10,
            sort: [{ key: 'id', order: SortItemDirection.ASC }],
        });

        const response = await fetchAsAdmin(() => balanceItemPaymentsLoader().fetch(request));
        const rows = response.results as PaymentWithItem[];
        const orderNumber = getColumn<PaymentWithItem>(balanceItemPaymentsLoader().getSheets(Platform.create({}))[0].columns, 'orderNumber');

        const byBalanceItem = new Map(rows.map(row => [row.balanceItemPayment.balanceItem.id, orderNumber.getValue(row).value]));
        expect(byBalanceItem.get(live.balanceItem.id)).toBe(123);
        expect(byBalanceItem.get(deleted.balanceItem.id)).toBe('Verwijderd');
    });
});
