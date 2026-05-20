import { SimpleError } from '@simonbackx/simple-errors';
import { Image, Organization, Platform} from '@stamhoofd/models';
import { BalanceItem, Invoice, InvoicedBalanceItem, Payment } from '@stamhoofd/models';
import { render } from '@stamhoofd/models/helpers/Handlebars.js';
import { InvoiceCounter } from '@stamhoofd/models/helpers/InvoiceCounter.js';
import type { Address, Invoice as InvoiceStruct } from '@stamhoofd/structures';
import { CountryHelper, File, getVATExcemptInvoiceNote, getVATExcemptReasonName, PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import type { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Formatter } from '@stamhoofd/utility';
import fs from 'fs/promises';
import { ViesHelper } from '../helpers/ViesHelper.js';
import { BalanceItemService } from './BalanceItemService.js';
import { VERSION } from 'luxon';
import {v4 as uuidv4} from 'uuid'
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { signInternal } from '@stamhoofd/backend-env';

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

        if (struct.totalWithVAT === 0) {
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
                        human: $t('%1RZ')
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
                            })
                        })
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
                            })
                        })
                    }
                }

                if (left === 0) {
                    if (goingToInvoice < 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1R7', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                            })
                        })
                    } else if (goingToInvoice > 0) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1QE', {
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
                            human: $t('%1RA', {
                                'a-euro': Formatter.price(-goingToInvoice),
                                'name': balanceItem.getStructure().itemTitle,
                                'left-euro': Formatter.price(left),
                            })
                        })
                    } else if (goingToInvoice > left) {
                        throw new SimpleError({
                            code: 'error',
                            message: 'Cannot invoice',
                            human: $t('%1TS', {
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

            // Create PDF
            await this.generatePdf(model)
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

    static async generateHtml(invoice: Invoice) {
        const organization = await Organization.getByID(invoice.organizationId, true)
        const platform = await Platform.getShared()
        const payments = await Payment.select().where('invoiceId', invoice.id).fetch();
        const payment = payments[0] ?? null;

        const invoicedItems = await InvoicedBalanceItem.select().where('invoiceId', invoice.id).fetch();

        const seller = invoice.seller;
        const customer = invoice.customer;
        const company = customer.company;

        const formatAddress = (address: Address | null, includeCountry = false): string => {
            if (!address) {
                return '';
            }
            const arr = [
                `${address.street} ${address.number}, ${address.city}`,
            ];
            if (includeCountry) {
                arr.push(CountryHelper.getName(address.country))
            }
            return arr.join('\n');
        };

        const totalPrice = invoice.totalWithVAT;
        const isCreditNote = totalPrice < 0;

        const date = invoice.invoicedAt ?? invoice.createdAt;
        const isPaid = payment?.status === PaymentStatus.Succeeded;
        const dueDate = isPaid
            ? date
            : (invoice.dueAt ?? new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000));

        const VATTotal = invoice.VATTotal.map(subtotal => ({
            VATPercentage: subtotal.VATPercentage,
            percentageLabel: Formatter.percentage(subtotal.VATPercentage * 100),
            taxablePrice: subtotal.taxablePrice,
            VAT: subtotal.VAT,
            VATExcempt: subtotal.VATExcempt,
            VATExcemptName: subtotal.VATExcempt ? getVATExcemptReasonName(subtotal.VATExcempt) : null,
        }));

        const hasMultipleVATRates = VATTotal.length > 1;
        const firstVATSubtotal = invoice.VATTotal[0] ?? null;
        const singleVATRateLabel = !hasMultipleVATRates && firstVATSubtotal
            ? Formatter.percentage(firstVATSubtotal.VATPercentage * 100)
            : '';

        let vatExcemptNote: string | null = null;
        if (!hasMultipleVATRates && firstVATSubtotal) {
            if (firstVATSubtotal.VATExcempt) {
                vatExcemptNote = getVATExcemptInvoiceNote(firstVATSubtotal.VATExcempt);
            }
            else if (firstVATSubtotal.VATPercentage === 0) {
                vatExcemptNote = $t('%1Q3');
            }
        }

        const trimmedVATNumber = company?.VATNumber?.replace(/\D+/g, '').replace(/^\d{0,2}/, '');
        const showCompanyNumber = !!company?.companyNumber
            && (!company?.VATNumber || company.companyNumber.replace(/\D+/g, '') !== trimmedVATNumber);

        const showDueDate = !!invoice.number && totalPrice >= 0;
        const hasRoundingAmount = invoice.payableRoundingAmount !== 0;

        const showPaidMessage = !!payment && payment.method !== null && payment.status === PaymentStatus.Succeeded && totalPrice >= 0;
        const showTransferMessage = !!payment && payment.method === PaymentMethod.Transfer && payment.status !== PaymentStatus.Succeeded && totalPrice >= 0;
        const showDirectDebitMessage = !!payment && payment.method === PaymentMethod.DirectDebit && payment.status !== PaymentStatus.Succeeded && totalPrice >= 0;
        const showStripeMessage = !payment && !!invoice.stripeAccountId && totalPrice >= 0;

        const customerName = customer.firstName && customer.lastName
            ? `${customer.firstName} ${customer.lastName}`
            : (customer.firstName ?? customer.lastName ?? '');

        const context = {
            // TODO: replace with hosted asset URLs
            logoUrl: organization.meta.horizontalLogo?.getPathForSize(400, undefined),
            firstPageBackgroundUrl: organization.privateMeta.invoiceSettings.background?.getPublicPath(),
            otherPageBackgroundUrl: organization.privateMeta.invoiceSettings.secondBackground?.getPublicPath() ?? organization.privateMeta.invoiceSettings.background?.getPublicPath(),
            fontSemiBoldUrl: '',
            fontMediumUrl: '',
            colors: {
                primary: organization.meta.color ?? platform.config.color ?? '#0053ff',
            },

            sender: {
                name: seller.name,
                address: formatAddress(seller.address, false),
                vatNumber: seller.VATNumber ?? '',
                bankAccount: organization.meta.registrationPaymentConfiguration.transferSettings.iban ?? '',
            },

            invoice: {
                id: invoice.id,
                number: invoice.number,
                meta: {
                    date,
                    items: invoicedItems.map(item => ({
                        amount: item.quantity / 1_00_00,
                        name: item.name,
                        description: item.description,
                        unitPriceExclVAT: item.unitPrice,
                        priceExclVAT: item.totalWithoutVAT,
                        percentageLabel: Formatter.percentage(item.VATPercentage * 100),
                    })),
                    priceWithoutVAT: invoice.totalWithoutVAT,
                    VAT: invoice.VATTotalAmount,
                    VATTotal,
                    hasMultipleVATRates,
                    singleVATRateLabel,
                    vatExcemptNote,
                    payableRoundingAmount: invoice.payableRoundingAmount,
                    totalPrice,
                },
                customer: {
                    name: customer.dynamicName,
                    contactName: !!customer.company && !!customer.name ? customer.name : null,
                    address: company?.address ? formatAddress(company.address ?? null, seller.address?.country !== company.address.country ) : null,
                    companyNumber: company?.companyNumber ?? '',
                    VATNumber: company?.VATNumber ?? '',
                },
            },

            payment: payment
                ? {
                    methodName: payment.method ? PaymentMethodHelper.getName(payment.method) : '',
                    transferDescription: payment.transferDescription ?? '',
                }
                : null,

            isCreditNote,
            showDueDate,
            dueDate,
            showCompanyNumber,
            hasRoundingAmount,
            showPaidMessage,
            showTransferMessage,
            showDirectDebitMessage,
            showStripeMessage,
        };

        const file = await fs.readFile(import.meta.dirname+'/data/invoice.hbs.html', 'utf-8')
        const renderedHtml = await render(file , context);
        return renderedHtml;
    }

    static async uploadPdf(invoice: Invoice, fileContent: Buffer) {
        const fileId = uuidv4();

         let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
        if (prefix.length > 0) {
            prefix += '/';
        }

        const envPrefix = STAMHOOFD.environment !== 'production' ? STAMHOOFD.environment : null;

        if (envPrefix && envPrefix !== (STAMHOOFD.SPACES_PREFIX ?? '')) {
            prefix += envPrefix + '/';
        }

        const key = prefix + 'invoices/' + fileId + '.pdf';

        const fileStruct = new File({
            id: fileId,
            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.byteLength,
            name: (invoice.number ?? invoice.id),
            isPrivate: true,
            contentType: 'application/pdf',
        });

        const cmd = new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent,
            ContentType: 'application/pdf',
            ACL: 'private'
        });
        await Image.getS3Client().send(cmd);

        // Sign the structure so it is accessible
        if (!await fileStruct.sign()) {
            throw new SimpleError({
                code: 'failed_to_sign',
                message: 'Failed to sign file',
                human: $t('%B6'),
                statusCode: 500,
            });
        }
        
        return fileStruct
    }

    static async generatePdf(invoice: Invoice) {
        const html = await this.generateHtml(invoice);
        if (!html) {
            throw new Error('Failed to render invoice ' + invoice.id)
        }
        const form = new FormData();

        // File field

        // Sign fields
        const cacheId = 'invoice-' + invoice.id;
        console.log('html length:', html.length);
        form.append('html', new Blob([html], { type: 'text/html' }));
        form.append('cacheId', cacheId);
        form.append('signature', signInternal(cacheId, invoice.updatedAt.getTime().toString(), html));
        form.append('timestamp', invoice.updatedAt.getTime().toString());

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        try {
            // Issue with system trusted CA in development
            const result = await fetch((STAMHOOFD.environment === 'development' ? 'http://' : 'https://')+ STAMHOOFD.domains.rendererApi + '/v'+VERSION+'/html-to-pdf', {
                method: 'POST',
                body: form,
                signal: controller.signal,
            });
            if (result.status === 200) {
                // todo
                const buffer = Buffer.from(await result.arrayBuffer())
                const file = await this.uploadPdf(invoice, buffer);
                invoice.pdf = file;
                await invoice.save();
            } else {
                // todo
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw new Error('Request timed out after 30s');
            }
            console.error(err);
        } finally {
            clearTimeout(timeout);
        }
    }
}
