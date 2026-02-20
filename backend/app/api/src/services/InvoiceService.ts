import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, BalanceItemPayment, Invoice, InvoicedBalanceItem, Organization, Payment } from '@stamhoofd/models';
import { InvoicedBalanceItem as InvoicedBalanceItemStruct, Invoice as InvoiceStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ViesHelper } from '../helpers/ViesHelper.js';

export class InvoiceService {
    static async invoicePayment(payment: Payment) {
        if (!payment.customer) {
            throw new SimpleError({
                code: 'missing_customer',
                message: 'Missing customer',
                field: 'customer',
                human: $t('cb28c759-7ab7-4a07-8972-9523393993ac'),
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
                human: $t('abd43002-de39-4d64-96c0-1c801c27e764', {
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

        return await this.createFrom(organization, struct, { payments: [payment], balanceItems });
    }

    static async createFrom(organization: { id: string }, struct: InvoiceStruct, options?: { payments?: Payment[]; balanceItems?: BalanceItem[] }) {
        if (struct.number) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'You cannot create new invoices with a fixed number. Numbers are auto-generated.',
                field: 'number',
            });
        }

        if (struct.items.length === 0) {
            throw new SimpleError({
                code: 'missing_items',
                message: 'Cannot create invoice without items',
            });
        }

        const model = new Invoice();
        model.customer = struct.customer;

        if (model.customer.company) {
            await ViesHelper.checkCompany(model.customer.company, model.customer.company);
        }

        struct.updatePrices();
        struct.validateVATRates();

        if (struct.totalBalanceInvoicedAmount === 0) {
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

        model.seller = struct.seller;
        model.organizationId = organization.id;
        model.payingOrganizationId = struct.payingOrganizationId;

        model.payableRoundingAmount = struct.payableRoundingAmount;
        model.VATTotal = struct.VATTotal;
        model.VATTotalAmount = struct.VATTotalAmount;
        model.totalWithoutVAT = struct.totalWithoutVAT;
        model.totalWithVAT = struct.totalWithVAT;
        model.totalBalanceInvoicedAmount = struct.totalBalanceInvoicedAmount;

        model.ipAddress = struct.ipAddress;
        model.userAgent = struct.userAgent;

        model.stripeAccountId = struct.stripeAccountId;
        model.reference = struct.reference;

        model.negativeInvoiceId = struct.negativeInvoiceId;

        if (Math.abs(model.payableRoundingAmount) > 10_00) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'payableRoundingAmount cannot be more than 10 cent',
                human: $t('De afrondingscorrectie van de factuur tegenover het aangerekende bedrag is meer dan 10 cent, dit is niet toegestaan.'),
                field: 'payableRoundingAmount',
            });
        }
        const payments = options?.payments ?? await Payment.getByIDs(...struct.payments.map(p => p.id));

        if (payments.length !== struct.payments.length) {
            throw new SimpleError({
                statusCode: 404,
                code: 'not_found',
                message: 'Payment not found',
            });
        }

        for (const payment of payments) {
            if (payment.organizationId !== model.organizationId) {
                throw new SimpleError({
                    statusCode: 404,
                    code: 'not_found',
                    message: 'Payment not found',
                });
            }

            if (payment.invoiceId) {
                throw new SimpleError({
                    code: 'already_invoiced',
                    message: 'You cannot invoice a payment multiple times',
                });
            }
        }

        const balanceItems = options?.balanceItems ?? await BalanceItem.getByIDs(...Formatter.uniqueArray(struct.items.map(i => i.balanceItemId)));
        await model.save();

        try {
            // Create balances
            for (const item of struct.items) {
                const balanceItem = balanceItems.find(b => b.id === item.balanceItemId);
                if (!balanceItem || balanceItem.organizationId !== model.organizationId) {
                    throw new SimpleError({
                        statusCode: 404,
                        code: 'not_found',
                        message: 'Balance item not found',
                    });
                }

                // Todo: check we are not invoicing more than maximum invoiceable for these items

                const invoiced = new InvoicedBalanceItem();
                invoiced.invoiceId = model.id;
                invoiced.organizationId = model.organizationId;
                invoiced.balanceItemId = item.balanceItemId;

                invoiced.VATExcempt = item.VATExcempt;
                invoiced.VATPercentage = item.VATPercentage;
                invoiced.VATIncluded = item.VATIncluded;

                invoiced.unitPrice = item.unitPrice;
                invoiced.quantity = item.quantity;

                invoiced.balanceInvoicedAmount = item.balanceInvoicedAmount;

                invoiced.totalWithoutVAT = item.totalWithoutVAT;

                invoiced.name = item.name || balanceItem.description;
                invoiced.description = item.description;

                await invoiced.save();
            }

            // Link payments
            for (const payment of payments) {
                payment.invoiceId = model.id;
                await payment.save();
            }
        }
        catch (e) {
            try {
                await model.delete();
            }
            catch (ee) {
                console.error('Error while trying to delete invoice because of fail save', ee, 'Deleting because of error', e);
            }
            throw e;
        }

        return model;
    }
}
