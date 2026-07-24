import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { BalanceItem, Invoice, InvoicedBalanceItem, Organization, Payment, sendEmailTemplate } from '@stamhoofd/models';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import type { Invoice as InvoiceStruct } from '@stamhoofd/structures';
import { EmailTemplateType, PaymentStatus, Recipient, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ViesHelper } from '../helpers/ViesHelper.js';
import { BalanceItemService } from './BalanceItemService.js';
import { InvoicePdfService } from './InvoicePdfService.js';
import { InvoiceXMlService } from './InvoiceXMLService.js';

export class InvoiceService {
    static async createFrom(organization: Organization, struct: InvoiceStruct, options?: { payments?: Payment[]; balanceItems?: BalanceItem[] }) {
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
                statusCode: 400,
            });
        }

        if (struct.totalWithVAT % 100 !== 0) {
            throw new SimpleError({
                code: 'invalid_price_decimals',
                message: 'Unexpected invoice total price with more than two decimals',
                statusCode: 500,
            });
        }

        if (struct.totalWithVAT === 0) {
            throw new SimpleError({
                code: 'invalid_invoiced_amount',
                message: 'Cannot invoice zero',
                statusCode: 400,
            });
        }

        if (struct.customer.company && struct.customer.company.isSameEntity(struct.seller)) {
            throw new SimpleError({
                code: 'invalid_customer',
                message: 'Cannot self invoice',
                human: $t('%ZaI'),
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

        // todo: permission checks
        // model.negativeInvoiceId = struct.negativeInvoiceId;

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

            if (payment.status === PaymentStatus.Failed) {
                throw new SimpleError({
                    code: 'failed_payment',
                    message: 'You cannot invoice failed payments',
                    human: $t('%1ZW'),
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
                const maximumInvoiceable = balanceItem.priceDue; // € - 10
                const alreadyInvoiced = balanceItem.priceInvoiced; // € 5
                const left = maximumInvoiceable - alreadyInvoiced; // € -15
                const goingToInvoice = item.balanceInvoicedAmount;

                if (item.quantity === 0) {
                    // should not be saved!
                    throw new SimpleError({
                        statusCode: 400,
                        code: 'zero_quantity',
                        message: 'Cannot invoice a quantity of zero',
                        human: $t('%1RZ'),
                    });
                }

                if (left < 0) {
                    if (goingToInvoice > 0) {
                        // Item should be credited, yet we are trying to invoice it
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1RB', {
                                'a-euro': Formatter.price(goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(-left),
                            }),
                        });
                    }

                    if (goingToInvoice < left) {
                        // too much
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1Tm', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(-left),
                            }),
                        });
                    }
                }

                if (left === 0) {
                    if (goingToInvoice < 0) {
                        console.log(item);
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1R7', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                            }),
                        });
                    } else if (goingToInvoice > 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1QE', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                            }),
                        });
                    }
                }

                if (left > 0) {
                    if (goingToInvoice < 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1RA', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(left),
                            }),
                        });
                    } else if (goingToInvoice > left) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1TS', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(left),
                            }),
                        });
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
            await BalanceItemService.updateInvoiced(struct.items.map(i => i.balanceItemId));

            // Create PDF
            await InvoicePdfService.generatePdf(model);
            await InvoiceXMlService.generateXml(model);

            if (!await this.forwardInvoice(model, organization)) {
                await this.sendCustomerEmail(model, organization);
            }
        } catch (e) {
            try {
                await model.delete();
            } catch (ee) {
                console.error('Error while trying to delete invoice because of fail save', ee, 'Deleting because of error', e);
            }
            throw e;
        }

        return model;
    }

    static async retryInvoiceGenerationAndSending(model: Invoice) {
        const hadPdf = !!model.pdf;
        if (!model.pdf) {
            // Create PDF
            await InvoicePdfService.generatePdf(model);
        }

        if (!model.xml) {
            await InvoiceXMlService.generateXml(model);
        }

        const organization = await Organization.getByID(model.organizationId);
        if (!organization) {
            console.error('Unexpected missing organization for ' + model.id);
            return;
        }

        if (!await this.forwardInvoice(model, organization) && !model.didSendPeppol && !hadPdf) {
            await this.sendCustomerEmail(model, organization);
        }
    }

    /**
     * Permanently delete an invoice.
     *
     * Deleting the invoice cascades on the database level:
     * - the linked InvoicedBalanceItems are deleted (ON DELETE CASCADE)
     * - payments linked to this invoice have their invoiceId reset (ON DELETE SET NULL), so they can be invoiced again
     * - other invoices referencing this one via negativeInvoiceId have it reset (ON DELETE SET NULL)
     *
     * After deletion the invoiced cache of the affected balance items is recalculated.
     */
    static async delete(invoice: Invoice) {
        // Collect the affected balance items before deleting, because the invoiced balance items are cascade deleted.
        const { invoicedBalanceItems } = await Invoice.loadBalanceItems([invoice]);
        const balanceItemIds = Formatter.uniqueArray(invoicedBalanceItems.map(i => i.balanceItemId));

        await invoice.delete();

        // Recalculate the invoiced amount cache of the balance items that were invoiced by this invoice.
        await BalanceItemService.updateInvoiced(balanceItemIds);
    }

    private static shouldForwardInvoice(invoice: Invoice, organization: Organization) {
        if (invoice.didSendPeppol) {
            return {
                value: false,
            };
        }

        if (!invoice.customer.company?.peppolEndpointId) {
            return {
                value: false,
                reason: 'No customer peppol endpoint id found for this invoice',
            };
        }

        // Legally sending an invoice via PEPPOL is not always required.
        // Logic: send if required or a custom peppol endpoint id is set
        if (organization.privateMeta.invoiceSettings.forwardOnlyVAT) {
            if (!invoice.customer.company?.customPeppolEndpointId) {
                if (!invoice.customer?.company?.VATNumber || !invoice.customer?.company?.VATNumber.startsWith('BE')) {
                    return {
                        value: false,
                        reason: 'Skipping PEPPOL for invoice ' + invoice.id + ', recipient no Belgian VAT number and no custom peppol endpoint id set',
                    };
                }
            }
        }

        return {
            value: true,
        };
    }

    /**
     * This is used for PEPPOL.
     * Invoice is forwarded to an external invoicing tool which will send it via PEPPOL.
     */
    static async forwardInvoice(invoice: Invoice, organization: Organization) {
        const { value, reason } = this.shouldForwardInvoice(invoice, organization);

        if (!value) {
            if (reason) {
                console.log('Skipped sending PEPPOL: ', reason);
            }
            return;
        }

        if (!organization.privateMeta.invoiceSettings.forwardEmailHandlers.length) {
            console.error('PEPPOL email handlers NOT CONFIGURED');
            return;
        }

        const xml = await invoice.xml?.withSignedUrl();

        if (!xml) {
            console.error('Could not send PEPPOL for invoice ' + invoice.id + ', xml not set');
            return;
        }

        // Send the e-mail
        Email.send({
            // From address is fixed for sender validation
            from: Email.getWebmasterFromEmail(),
            to: organization.privateMeta.invoiceSettings.forwardEmailHandlers.map((d) => {
                return {
                    email: d,
                };
            }),
            subject: $t('%1Zw') + ' ' + invoice.number,
            text: $t('%1X5'),
            attachments: [
                {
                    filename: invoice.generateCustomerFilename('xml'),
                    href: xml.getPublicPath(),
                    contentType: 'application/xml',
                },
            ],
        });

        invoice.didSendPeppol = true;
        await invoice.save();
        return true;
    }

    static async sendCustomerEmail(invoice: Invoice, organization: Organization) {
        let email = (invoice.customer.email || invoice.customer.company?.administrationEmail) ?? undefined;
        let bcc = invoice.customer.company?.administrationEmail;

        if (!email && invoice.payingOrganizationId) {
            const payingOrganization = await Organization.getByID(invoice.payingOrganizationId);
            if (payingOrganization) {
                email = (await payingOrganization.getInvoicingToEmail()) ?? undefined;
            }
        }

        if (bcc === email) {
            bcc = undefined;
        }

        if (!email) {
            console.log('Skipped sending invoice email: no email address found for ' + invoice.id);
            return;
        }

        const payments = await Payment.select().where('invoiceId', invoice.id).fetch();
        const isPaid = payments.every(p => p.status === PaymentStatus.Succeeded);

        const pdf = await invoice.pdf?.withSignedUrl();
        const xml = await invoice.xml?.withSignedUrl();

        const recipients = [
            Recipient.create({
                email,
                replacements: [
                    Replacement.create({
                        token: 'invoiceNumber',
                        value: invoice.number ?? '',
                    }),
                    Replacement.create({
                        token: 'totalPrice',
                        value: Formatter.price(Math.abs(invoice.totalWithVAT)),
                    }),
                ],
            }),
        ];

        if (bcc) {
            recipients.push(Recipient.create({
                email: bcc,
                replacements: [
                    Replacement.create({
                        token: 'invoiceNumber',
                        value: invoice.number ?? '',
                    }),
                    Replacement.create({
                        token: 'totalPrice',
                        value: Formatter.price(Math.abs(invoice.totalWithVAT)),
                    }),
                ],
            }));
        }

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({
                    email,
                    replacements: [
                        Replacement.create({
                            token: 'invoiceNumber',
                            value: invoice.number ?? '',
                        }),
                        Replacement.create({
                            token: 'totalPrice',
                            value: Formatter.price(Math.abs(invoice.totalWithVAT)),
                        }),
                    ],
                }),
            ],
            template: {
                type: isPaid
                    ? (invoice.totalWithVAT >= 0 ? EmailTemplateType.InvoicePaid : EmailTemplateType.CreditNotePaid)
                    : (invoice.totalWithVAT >= 0 ? EmailTemplateType.InvoiceUnpaid : EmailTemplateType.CreditNoteUnpaid),
            },
            type: 'transactional',
            attachments: [
                ...(pdf
                    ? [
                            {
                                filename: invoice.generateCustomerFilename('pdf'),
                                href: pdf.getPublicPath(),
                                contentType: 'application/pdf',
                            },
                        ]
                    : []),
                ...(xml
                    ? [
                            {
                                filename: invoice.generateCustomerFilename('xml'),
                                href: xml.getPublicPath(),
                                contentType: 'application/xml',
                            },
                        ]
                    : []),
            ],
        });
    }
}
