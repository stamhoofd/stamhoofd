import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Invoice, Organization, Payment } from '@stamhoofd/models';
import { InvoicedBalanceItem as InvoicedBalanceItemStruct, Invoice as InvoiceStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export class InvoiceService {
    static async invoicePayment(payment: Payment) {
        if (!payment.customer) {
            throw new SimpleError({
                code: 'missing_customer',
                message: 'Missing customer',
                field: 'customer',
                human: $t('Er kan geen factuur aangemaakt worden omdat de klantgegevens ontbreken voor deze betaling'),
            });
        }

        if (payment.price % 100 !== 0) {
            throw new SimpleError({
                code: 'invalid_price_decimals',
                message: 'Cannot invoice a payment with a price having more than two decimals',
            });
        }

        const organization = payment.organizationId ? await Organization.getByID(payment.organizationId) : null;
        if (!organization) {
            throw new SimpleError({
                code: 'missing_organization',
                message: 'Cannot invoice a payment without corresponding organization',
                statusCode: 500,
            });
        }

        // Find default company
        const seller = organization.meta.companies[0];

        if (!seller) {
            throw new SimpleError({
                code: 'missing_company',
                message: 'Missing invoice settings (companies)',
                human: $t('Het is niet mogelijk om facturen uit te schrijven omdat er nog geen facturatiegegevens zijn ingesteld voor {organization-name}', {
                    'organization-name': organization.name,
                }),
            });
        }

        const items: InvoicedBalanceItemStruct[] = [];
        const balanceItemPayments = await BalanceItemPayment.select().where('paymentId', payment.id).fetch();
        const balanceItems = await BalanceItem.getByIDs(...Formatter.uniqueArray(balanceItemPayments.map(d => d.balanceItemId)));

        for (const balanceItemPayment of balanceItemPayments) {
            const balanceItem = balanceItems.find(b => b.id === balanceItemPayment.balanceItemId);
            if (!balanceItem) {
                throw new SimpleError({
                    code: 'missing_balance_item',
                    message: 'Balance item missing for balanceItemPayment ' + balanceItemPayment.id,
                    statusCode: 500,
                });
            }

            const item = InvoicedBalanceItemStruct.createFor(balanceItem.getStructure(), balanceItemPayment.price);
            items.push(item);
        }

        const struct = InvoiceStruct.create({
            organizationId: organization.id,
            seller,
            customer: payment.customer,
            payingOrganizationId: payment.payingOrganizationId,
            items,
        });

        struct.calculateVAT();

        if (struct.totalBalanceInvoicedAmount <= 0) {
            throw new SimpleError({
                code: 'invalid_invoiced_amount',
                message: 'Unexpected 0 totalBalanceInvoicedAmount',
            });
        }

        if (struct.totalWithVAT % 100 !== 0) {
            throw new SimpleError({
                code: 'invalid_price_decimals',
                message: 'Unexpected invoice total price with more than two decimals',
                statusCode: 500,
            });
        }

        // Update payableRoundingAmount to match payment price
        const difference = payment.price - struct.totalWithVAT;
        if (Math.abs(difference) > 10_00) {
            // Difference of more than 10 cent!
            throw new SimpleError({
                code: 'unexpected_price_difference',
                message: 'The invoice and payment amounts differ by more than €0.10.',
                statusCode: 500,
            });
        }

        if (difference % 100 !== 0) {
            throw new SimpleError({
                code: 'invalid_price_decimals',
                message: 'Unexpected payableRoundingAmount with more than two decimals',
                statusCode: 500,
            });
        }

        struct.payableRoundingAmount = difference;

        // Todo: check we are not invoicing more than maximum invoiceable for these items

        return await Invoice.createFrom(organization, struct);
    }
}
