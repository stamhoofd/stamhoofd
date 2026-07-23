import { PutObjectCommand } from '@aws-sdk/client-s3';
import { SimpleError } from '@simonbackx/simple-errors';
import { signInternal } from '@stamhoofd/backend-env';
import type { Invoice } from '@stamhoofd/models';
import { Image, InvoicedBalanceItem, Organization, Payment, Platform } from '@stamhoofd/models';
import { render } from '@stamhoofd/models/helpers/Handlebars.js';
import type { Address } from '@stamhoofd/structures';
import { CountryHelper, File, getVATExcemptInvoiceNote, getVATExcemptReasonName, PaymentMethod, PaymentMethodHelper, PaymentStatus, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export class InvoicePdfService {
    static async generateHtml(invoice: Invoice) {
        const organization = await Organization.getByID(invoice.organizationId, true);
        const platform = await Platform.getShared();
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
                arr.push(CountryHelper.getName(address.country));
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
            } else if (firstVATSubtotal.VATPercentage === 0) {
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
                    address: company?.address ? formatAddress(company.address ?? null, seller.address?.country !== company.address.country) : null,
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

        const file = await fs.readFile(import.meta.dirname + '/data/invoice.hbs.html', 'utf-8');
        const renderedHtml = await render(file, context);
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
            ACL: 'private',
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

        return fileStruct;
    }

    static async downloadPdf(invoice: Invoice) {
        if (!invoice.pdf) {
            return null;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const c = (await invoice.pdf.withSignedUrl())?.getPublicPath();
            if (!c) {
                return null;
            }
            // Issue with system trusted CA in development
            const result = await fetch(c, {
                method: 'GET',
                signal: controller.signal,
            });
            if (result.status === 200) {
                return Buffer.from(await result.arrayBuffer());
            } else {
                // todo
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw new Error('Request timed out after 10s');
            }
            console.error(err);
        } finally {
            clearTimeout(timeout);
        }
    }

    static async generatePdf(invoice: Invoice) {
        const html = await this.generateHtml(invoice);
        if (!html) {
            throw new Error('Failed to render invoice ' + invoice.id);
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
            const result = await fetch((STAMHOOFD.environment === 'development' ? 'http://' : 'https://') + STAMHOOFD.domains.rendererApi + '/v' + Version + '/html-to-pdf', {
                method: 'POST',
                body: form,
                signal: controller.signal,
            });
            if (result.status === 200) {
                // todo
                const buffer = Buffer.from(await result.arrayBuffer());
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
