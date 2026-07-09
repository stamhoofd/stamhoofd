import { PutObjectCommand } from '@aws-sdk/client-s3';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Invoice } from '@stamhoofd/models';
import { Image, InvoicedBalanceItem, Organization, Payment } from '@stamhoofd/models';
import { File, getPeppolCategoryCode, getVATExcemptInvoiceNote, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Formatter, STMath } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { InvoicePdfService } from './InvoicePdfService.js';

export class InvoiceXMlService {
    static async buildXml(invoice: Invoice) {
        if (!invoice.number || !invoice.invoicedAt) {
            throw new Error('Cannot generate UBL for invoice without number');
        }

        if (!invoice.pdf) {
            throw new Error('Cannot generate UBL for invoice without pdf');
        }

        const company = invoice.customer.company;

        if (!company || !company.address) {
            throw new Error('Cannot generate UBL for invoice without company');
        }

        const seller = invoice.seller;
        if (!seller.address) {
            throw new Error('Missing seller address');
        }

        const sellerPeppolEndpointId = seller.peppolEndpointId;
        const sellerPeppolCompanyId = seller.peppolCompanyId;

        const customerPeppolEndpointId = company.peppolEndpointId;
        const customerPeppolCompanyId = company.peppolCompanyId;

        if (!sellerPeppolEndpointId || !sellerPeppolCompanyId) {
            throw new Error('Missing seller peppol id');
        }

        if (!customerPeppolEndpointId || !customerPeppolCompanyId) {
            throw new Error('Missing customer peppol id');
        }

        const companyNumberOrVAT = company.VATNumber ?? company.companyNumber;
        if (!companyNumberOrVAT) {
            throw new Error('Cannot generate UBL for invoice without VAT or company number');
        }

        if (company.address.country !== Country.Belgium) {
            throw new Error('Cannot generate UBL for invoice outside belgium');
        }
        const companyNumber = (company.VATNumber ? company.VATNumber.substring(2) : companyNumberOrVAT).replace(/\D+/g, '');

        const payments = await Payment.select().where('invoiceId', invoice.id).fetch();
        const payment = payments[0] ?? null;

        const pdfBuffer = await InvoicePdfService.downloadPdf(invoice);
        if (!pdfBuffer) {
            throw new Error('Pdf unavailable');
        }

        const type = invoice.totalWithVAT < 0 ? 'CreditNote' : 'Invoice';
        const multiplyAmounts = invoice.totalWithVAT < 0 ? -1 : 1;

        let customerEmail: string | null = company.administrationEmail ?? invoice.customer.email ?? null;
        if (!customerEmail && invoice.payingOrganizationId) {
            const payingOrganization = await Organization.getByID(invoice.payingOrganizationId);
            if (payingOrganization) {
                customerEmail = (await payingOrganization.getInvoicingToEmail()) ?? null;
            }
        }

        let ubl = ``;

        function esc(a: string) {
            return Formatter.escapeHtml(a);
        }

        function price(price: number, options?: { invert?: boolean; round?: boolean }) {
            if (options?.round ?? true) {
                return esc((STMath.round((options?.invert ? multiplyAmounts : 1) * price / 100) / 100).toFixed(2));
            }
            return esc(((options?.invert ? multiplyAmounts : 1) * price / 100_00).toString());
        }

        // Docs: https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/
        // Note: order is important

        // General
        ubl += `<cbc:ID>${esc(invoice.number)}</cbc:ID>`;
        const date = invoice.invoicedAt;
        ubl += `<cbc:IssueDate>${esc(Formatter.dateIso(date))}</cbc:IssueDate>`;

        // PEPPOL allows credit notes as negative invoices, so we always use invoice type code = invoice

        if (type === 'Invoice') {
            ubl += `<cbc:DueDate>${esc(Formatter.dateIso(new Date(date.getTime() + 1000 * 60 * 60 * 24 * 30)))}</cbc:DueDate>`;
            ubl += `<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>`;
        } else {
            ubl += `<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>`;
        }

        ubl += `<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>`;
        ubl += `<cbc:BuyerReference>${esc(invoice.organizationId ?? invoice.id)}</cbc:BuyerReference>`;

        // Attachments
        const filename = invoice.generateCustomerFilename('pdf');
        const base64 = pdfBuffer.toString('base64'); // No escaping needed for invoice charset
        ubl += `
            <cac:AdditionalDocumentReference>
                <cbc:ID>${esc(filename)}</cbc:ID>
                <cac:Attachment>
                    <cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="${esc(filename)}">${base64}</cbc:EmbeddedDocumentBinaryObject>
                </cac:Attachment>
            </cac:AdditionalDocumentReference>`;

        // Supplier
        ubl += `
            <cac:AccountingSupplierParty>
                <cac:Party>
                    <cbc:EndpointID schemeID="${esc(sellerPeppolEndpointId.schemeID)}">${esc(sellerPeppolEndpointId.id)}</cbc:EndpointID>
                    <cac:PartyName>
                        <cbc:Name>${esc(seller.name)}</cbc:Name>
                    </cac:PartyName>
                    <cac:PostalAddress>
                        <cbc:StreetName>${esc(seller.address.street)} ${esc(seller.address.number)}</cbc:StreetName>
                        <cbc:CityName>${esc(seller.address.city)}</cbc:CityName>
                        <cbc:PostalZone>${esc(seller.address.postalCode)}</cbc:PostalZone>
                        <cac:Country>
                            <cbc:IdentificationCode>${esc(seller.address.country)}</cbc:IdentificationCode>
                        </cac:Country>
                    </cac:PostalAddress>
                    ${
                        seller.VATNumber
                            ? `
                        <cac:PartyTaxScheme>
                            <cbc:CompanyID>${esc(seller.VATNumber)}</cbc:CompanyID>
                            <cac:TaxScheme>
                                <cbc:ID>VAT</cbc:ID>
                            </cac:TaxScheme>
                        </cac:PartyTaxScheme>`
                            : ``
                    }
                    <cac:PartyLegalEntity>
                        <cbc:RegistrationName>${esc(seller.name)}</cbc:RegistrationName>
                        <cbc:CompanyID schemeID="${esc(sellerPeppolCompanyId.schemeID)}">${esc(sellerPeppolCompanyId.id)}</cbc:CompanyID>
                    </cac:PartyLegalEntity>
                    ${
                        seller.administrationEmail
                            ? `
                        <cac:Contact>
                            <cbc:ElectronicMail>${esc(seller.administrationEmail)}</cbc:ElectronicMail>
                        </cac:Contact>`
                            : ``
                    }
                </cac:Party>
            </cac:AccountingSupplierParty>`;

        /* const vatUbl = invoice.meta.companyVATNumber
            ? `<cac:PartyTaxScheme>
                    <cbc:CompanyID>${esc(invoice.meta.companyVATNumber.replace(/[^A-z0-9]+/g, ''))}</cbc:CompanyID>
                    <cac:TaxScheme>
                        <cbc:ID>VAT</cbc:ID>
                    </cac:TaxScheme>
                </cac:PartyTaxScheme>`
            : ``;

        const contactUbl = customerEmail
            ? `<cac:Contact>
                    <cbc:ElectronicMail>${esc(customerEmail)}</cbc:ElectronicMail>
                </cac:Contact>`
            : ''; */

        // Customer
        ubl += `
            <cac:AccountingCustomerParty>
                <cac:Party>
                    <cbc:EndpointID schemeID="${esc(customerPeppolEndpointId.schemeID)}">${esc(customerPeppolEndpointId.id)}</cbc:EndpointID>
                    <cac:PartyName>
                        <cbc:Name>${esc(company.name)}</cbc:Name>
                    </cac:PartyName>
                    <cac:PostalAddress>
                        <cbc:StreetName>${esc(company.address.street)} ${esc(company.address.number)}</cbc:StreetName>
                        <cbc:CityName>${esc(company.address.city)}</cbc:CityName>
                        <cbc:PostalZone>${esc(company.address.postalCode)}</cbc:PostalZone>
                        <cac:Country>
                            <cbc:IdentificationCode>${esc(company.address.country)}</cbc:IdentificationCode>
                        </cac:Country>
                    </cac:PostalAddress>
                    ${
                        company.VATNumber
                            ? `
                        <cac:PartyTaxScheme>
                            <cbc:CompanyID>${esc(company.VATNumber)}</cbc:CompanyID>
                            <cac:TaxScheme>
                                <cbc:ID>VAT</cbc:ID>
                            </cac:TaxScheme>
                        </cac:PartyTaxScheme>`
                            : ``
                    }
                    <cac:PartyLegalEntity>
                        <cbc:RegistrationName>${esc(company.name)}</cbc:RegistrationName>
                        <cbc:CompanyID schemeID="${esc(customerPeppolCompanyId.schemeID)}">${esc(customerPeppolCompanyId.id)}</cbc:CompanyID>
                    </cac:PartyLegalEntity>
                    ${
                        customerEmail
                            ? `
                        <cac:Contact>
                            <cbc:ElectronicMail>${esc(customerEmail)}</cbc:ElectronicMail>
                        </cac:Contact>`
                            : ``
                    }
                </cac:Party>
            </cac:AccountingCustomerParty>`;

        // Payment means
        // Codes:
        // 49 = direct debit
        // 48 = bank card
        // 54 = credit card
        // 55 = debit card
        // 59 = SEPA direct debit
        // 68 = Online payment service <- probably way to go for all except tranfer
        // 30 = credit transfer (Payment by credit movement of funds from one account to another.) <- way to go for

        if (!payment) {
            // Het bedrag werd reeds ingehouden van jouw Stripe balans.
            // Don't include payment means information
        } else {
            if (invoice.totalWithVAT < 0) {
                // todo: add how we are going to pay back
                // 99% chance we already have paid back using a refund
                // in other cases we might transfer it manually or it will not have been paid already
            } else {
                if (payment.method === PaymentMethod.Transfer) {
                    ubl += `<cac:PaymentMeans>
                                <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
                                <cbc:PaymentID>${esc(payment.transferDescription ?? '')}</cbc:PaymentID>
                                <cac:PayeeFinancialAccount>
                                    <cbc:ID>BE93733058873067</cbc:ID>
                                    <cbc:Name>Stamhoofd</cbc:Name>
                                </cac:PayeeFinancialAccount>
                            </cac:PaymentMeans>`;
                } else if (payment.status === PaymentStatus.Succeeded) {
                    const code = 48; // card - don't specify more

                    ubl += `<cac:PaymentMeans>
                        <cbc:PaymentMeansCode>${esc(code.toFixed(0))}</cbc:PaymentMeansCode>
                    </cac:PaymentMeans>`;
                }
            }
        }

        // Tax breakdown
        ubl += `<cac:TaxTotal>
            <cbc:TaxAmount currencyID="EUR">${price(invoice.VATTotalAmount)}</cbc:TaxAmount>`;

        if (invoice.VATTotal.length > 0) {
            for (const c of invoice.VATTotal) {
                ubl += `<cac:TaxSubtotal>
                        <cbc:TaxableAmount currencyID="EUR">${price(c.taxablePrice)}</cbc:TaxableAmount>
                        <cbc:TaxAmount currencyID="EUR">${price(c.VAT)}</cbc:TaxAmount>
                        <cac:TaxCategory>
                            <cbc:ID>${esc(c.peppolCategoryCode)}</cbc:ID>
                            <cbc:Percent>${esc(c.VATPercentage.toFixed(2))}</cbc:Percent>
                            ${c.VATExcempt ? `<cbc:TaxExemptionReasonCode>${esc(getVATExcemptInvoiceNote(c.VATExcempt))}</cbc:TaxExemptionReasonCode>` : ``}
                            ${c.VATExcempt ? `<cbc:TaxExemptionReason>${esc(getVATExcemptInvoiceNote(c.VATExcempt))}</cbc:TaxExemptionReason>` : ``}
                            <cac:TaxScheme>
                                <cbc:ID>VAT</cbc:ID>
                            </cac:TaxScheme>
                        </cac:TaxCategory>
                    </cac:TaxSubtotal>`;
            }
        }

        ubl += `</cac:TaxTotal>`;

        // Totals
        // Since sometimes we have invoices that start with a given paid amount, and prices inclusive VAT, we can have rounding issues.
        // In UBL, prices are always exclusive VAT.
        // so start with calculating the rounding error.
        // PayableRoundingAmount
        ubl += `<cac:LegalMonetaryTotal>
            <cbc:LineExtensionAmount currencyID="EUR">${price(invoice.totalWithoutVAT)}</cbc:LineExtensionAmount>
            <cbc:TaxExclusiveAmount currencyID="EUR">${price(invoice.totalWithoutVAT)}</cbc:TaxExclusiveAmount>
            <cbc:TaxInclusiveAmount currencyID="EUR">${price(invoice.totalWithVAT - invoice.payableRoundingAmount)}</cbc:TaxInclusiveAmount>
            <cbc:PrepaidAmount currencyID="EUR">${!payment || payment.status === PaymentStatus.Succeeded ? price(invoice.totalWithVAT) : '0'}</cbc:PrepaidAmount>
            <cbc:PayableRoundingAmount currencyID="EUR">${price(invoice.payableRoundingAmount)}</cbc:PayableRoundingAmount>
            <cbc:PayableAmount currencyID="EUR">${!payment || payment.status === PaymentStatus.Succeeded ? '0' : price(invoice.totalWithVAT)}</cbc:PayableAmount>
        </cac:LegalMonetaryTotal>`;

        // Invoice lines
        const invoicedItems = await InvoicedBalanceItem.select().where('invoiceId', invoice.id).fetch();

        for (const item of invoicedItems) {
            // We need to show prices exluding VAT and round here if needed
            let unitPrice = item.unitPrice;
            const totalPrice = item.totalWithoutVAT;
            let quantity = item.quantity;
            //
            // if (invoice.meta.areItemsIncludingVAT) {
            //    unitPrice = invoice.meta.includingVATToExcludingVAT(unitPrice)
            //    price = invoice.meta.includingVATToExcludingVAT(price)
            // }

            // unitPrice cant be negative, quantity can.
            if (unitPrice < 0) {
                quantity = -quantity;
                unitPrice = -unitPrice;
            }

            // Update sign for credit notes
            quantity = quantity * multiplyAmounts;

            ubl += `
                <cac:${type}Line>
                    <cbc:ID>${item.id}</cbc:ID>
                    <cbc:${type === 'Invoice' ? 'Invoiced' : 'Credited'}Quantity unitCode="EA">${(quantity / 100_00).toString()}</cbc:${type === 'Invoice' ? 'Invoiced' : 'Credited'}Quantity>
                    <cbc:LineExtensionAmount currencyID="EUR">${price(totalPrice)}</cbc:LineExtensionAmount>
                    <cac:Item>
                        ${item.description ? `<cbc:Description>${esc(item.description)}</cbc:Description>` : ''}
                        <cbc:Name>${esc(item.name)}</cbc:Name>
                        <cac:ClassifiedTaxCategory>
                            <cbc:ID>${esc(getPeppolCategoryCode(item))}</cbc:ID>
                            <cbc:Percent>${esc(item.VATPercentage.toFixed(2))}</cbc:Percent>
                            <cac:TaxScheme>
                                <cbc:ID>VAT</cbc:ID>
                            </cac:TaxScheme>
                        </cac:ClassifiedTaxCategory>
                    </cac:Item>
                    <cac:Price>
                        <cbc:PriceAmount currencyID="EUR">${price(unitPrice, { invert: false, round: false })}</cbc:PriceAmount>
                    </cac:Price>
                </cac:${type}Line>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
                <${type} xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns="urn:oasis:names:specification:ubl:schema:xsd:${type}-2">
                    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
                    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
                    ${ubl}
                </${type}>`;
    }

    static async uploadXml(invoice: Invoice, fileContent: Buffer) {
        const fileId = uuidv4();

        let prefix = (STAMHOOFD.SPACES_PREFIX ?? '');
        if (prefix.length > 0) {
            prefix += '/';
        }

        const envPrefix = STAMHOOFD.environment !== 'production' ? STAMHOOFD.environment : null;

        if (envPrefix && envPrefix !== (STAMHOOFD.SPACES_PREFIX ?? '')) {
            prefix += envPrefix + '/';
        }

        const key = prefix + 'invoices/' + fileId + '.xml';

        const fileStruct = new File({
            id: fileId,
            server: 'https://' + STAMHOOFD.SPACES_BUCKET + '.' + STAMHOOFD.SPACES_ENDPOINT,
            path: key,
            size: fileContent.byteLength,
            name: (invoice.number ?? invoice.id),
            isPrivate: true,
            contentType: 'application/xml',
        });

        const cmd = new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: fileContent,
            ContentType: 'application/xml',
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

    static async generateXml(invoice: Invoice) {
        if (invoice.didSendPeppol) {
            // Can't update if already generated/sent
            return;
        }

        if (!invoice.customer.company?.customPeppolEndpointId) {
            if (invoice.customer.company?.VATNumber === null) {
                console.log('Skipping PEPPOL for invoice ' + invoice.id + ', recipient not subject to VAT');
                return;
            }

            // Check VAT number is belgian
            if (!invoice.customer.company?.VATNumber.startsWith('BE')) {
                console.log('Skipping PEPPOL for invoice ' + invoice.id + ', recipient outside Belgium');
                return;
            }
        }

        try {
            const content = await this.buildXml(invoice);

            const file = await this.uploadXml(invoice, Buffer.from(content, 'utf-8'));
            invoice.xml = file;

            await invoice.save();
        } catch (e) {
            console.error('Failed to generate XML', invoice.id, e);
            return;
        }
    }
}
