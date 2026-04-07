import type { Page } from '@playwright/test';
import type { PaymentMethod, Product } from '@stamhoofd/structures';
import { TableHelper } from '../TableHelper.js';
import { EditOrderView } from './EditOrderView.js';

export class WebshopOrdersView {
    constructor(public readonly page: Page) {
    }

    async addOrder({firstName, lastName, email, phone, product, amount, paymentMethod}: {firstName: string, lastName: string, email: string, phone?: string, product: Product, amount?: number, paymentMethod?: PaymentMethod}) {
        // table
        const table = new TableHelper(this.page);
        await table.clickAction('Bestelling toevoegen');

        const editOrderView = new EditOrderView(this.page);
        await editOrderView.fillCustomerData({firstName, lastName, email, phone});
        await editOrderView.addProduct({
            product,
            amount: amount ?? 1
        });

        if (paymentMethod) {
            await editOrderView.selectPaymentMethod(paymentMethod);
        }

        await editOrderView.save();
    }

    async waitForFirstRow() {
        const table = new TableHelper(this.page);
        await table.waitForFirstRow();
    }
}
