import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Invoice, InvoicedBalanceItem, Payment } from '@stamhoofd/models';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import type { Invoice as InvoiceStruct } from '@stamhoofd/structures';
import type { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { ViesHelper } from '../helpers/ViesHelper.js';
import { BalanceItemService } from './BalanceItemService.js';

export class InvoiceService {
    static async createFrom(organization: { id: string, privateMeta: {invoiceSettings: OrganizationInvoiceSettings} }, struct: InvoiceStruct, options?: { payments?: Payment[]; balanceItems?: BalanceItem[] }) {
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
                statusCode: 400
            });
        }

        if (struct.totalWithVAT % 100 !== 0) {
            throw new SimpleError({
                code: 'invalid_price_decimals',
                message: 'Unexpected invoice total price with more than two decimals',
                statusCode: 500,
            });
        }

        if (struct.totalWithVAT % 100 === 0) {
            throw new SimpleError({
                code: 'invalid_invoiced_amount',
                message: 'Cannot invoice zero',
                statusCode: 400,
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
                human: $t('%1LG'),
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

        const balanceItemIds = Formatter.uniqueArray(struct.items.map(i => i.balanceItemId));

        // Make sure priceInvoiced is up to date for these balances
        const affected = await BalanceItem.updateInvoiced(balanceItemIds);

        if (affected && options?.balanceItems) {
            // Force update
            options!.balanceItems = undefined;
        }
        
        const balanceItems = options?.balanceItems ?? await BalanceItem.getByIDs(...balanceItemIds);
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
                const maximumInvoiceable = balanceItem.priceTotal; // € - 10
                const alreadyInvoiced = balanceItem.priceInvoiced; // € 5
                const left = maximumInvoiceable - alreadyInvoiced; // € -15
                const goingToInvoice = item.balanceInvoicedAmount;

                if (item.quantity === 0) {
                    // should not be saved!
                     throw new SimpleError({
                        statusCode: 400,
                        code: 'zero_quantity',
                        message: 'Cannot invoice a quantity of zero',
                        human: $t('Kan geen factuur opmaken voor een item met een aantal van 0 stuks')
                    });
                }

                if (left < 0) {
                    if (goingToInvoice > 0) {
                        // Item should be credited, yet we are trying to invoice it
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te factureren voor “{name}”. Je kan nog maximaal {left-euro} crediteren (niet factureren).', {
                                'a-euro': Formatter.price(goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(-left),
                            })
                        })
                    }

                    if (goingToInvoice < left) {
                        // too much
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te crediteren voor “{name}”. Je kan nog maximaal {left-euro} crediteren.', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(-left),
                            })
                        })
                    }
                }

                if (left === 0) {
                    if (goingToInvoice < 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te crediteren voor “{name}”. Dit item werd al volledig gefactureerd.', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                            })
                        })
                    } else if (goingToInvoice > 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te factureren voor “{name}”. Dit item werd al volledig gefactureerd.', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                            })
                        })
                    }
                }

                if (left > 0) {
                    if (goingToInvoice < 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te crediteren voor “{name}”. Je kan nog maximaal {left-euro} factureren (niet crediteren).', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(left),
                            })
                        })
                    } else if (goingToInvoice > left) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('Het is niet mogelijk om {a-euro} te factureren voor “{name}”. Je kan nog maximaal {left-euro} factureren', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(left),
                            })
                        })
                    }
                }

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

            // Finalize invoice by generating a number
            await InvoiceCounter.assignNextNumber(model, organization.privateMeta.invoiceSettings);

            // Update invoiced cache
            await BalanceItemService.updateInvoiced(struct.items.map(i => i.balanceItemId))
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
