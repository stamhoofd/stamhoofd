import { BalanceItemFactory, Invoice, InvoicedBalanceItem, OrganizationFactory } from '@stamhoofd/models';
import { Address, Company, File, PaymentCustomer, PeppolEndointId, VATSubtotal } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';
import { InvoicePdfService } from './InvoicePdfService.js';
import { InvoiceXMlService } from './InvoiceXMLService.js';

describe('InvoiceXMlService', () => {
    beforeEach(() => {
        // The pdf is embedded as base64 in the UBL; avoid the real network download.
        vi.spyOn(InvoicePdfService, 'downloadPdf').mockResolvedValue(Buffer.from('%PDF-1.4 test'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const belgianAddress = () => Address.create({
        street: 'Teststraat',
        number: '1',
        city: 'Gent',
        postalCode: '9000',
        country: Country.Belgium,
    });

    const seller = () => Company.create({
        name: 'Seller BV',
        VATNumber: 'BE0411905847',
        companyNumber: '0411905847',
        address: belgianAddress(),
        administrationEmail: 'billing@seller.be',
    });

    /**
     * Builds and persists a minimal, valid invoice for the given customer company, with one
     * invoiced line, so that InvoiceXMlService.buildXml can generate the UBL.
     */
    const buildInvoiceFor = async (company: Company) => {
        const organization = await new OrganizationFactory({}).create();

        const invoice = new Invoice();
        invoice.organizationId = organization.id;
        invoice.number = 'F2026-001';
        invoice.invoicedAt = new Date(2026, 0, 15);
        invoice.pdf = new File({ id: uuidv4(), server: 'https://files.example.com', path: 'test.pdf', size: 100, name: 'invoice', contentType: 'application/pdf' });
        invoice.customer = PaymentCustomer.create({ company });
        invoice.seller = seller();
        invoice.totalWithVAT = 12_10;
        invoice.totalWithoutVAT = 10_00;
        invoice.VATTotalAmount = 2_10;
        invoice.payableRoundingAmount = 0;
        invoice.VATTotal = [VATSubtotal.create({ VATPercentage: 21, taxablePrice: 10_00, VAT: 2_10 })];
        await invoice.save();

        const balanceItem = await new BalanceItemFactory({ organizationId: organization.id, amount: 1, unitPrice: 10_00 }).create();

        const item = new InvoicedBalanceItem();
        item.organizationId = organization.id;
        item.invoiceId = invoice.id;
        item.balanceItemId = balanceItem.id;
        item.name = 'Test item';
        item.unitPrice = 10_00;
        item.totalWithoutVAT = 10_00;
        item.quantity = 1_00_00;
        item.VATPercentage = 21;
        item.balanceInvoicedAmount = 12_10;
        await item.save();

        return invoice;
    };

    test('generates XML for a Belgian company with a VAT number', async () => {
        const company = Company.create({
            name: 'Customer BV',
            VATNumber: 'BE0123456749',
            companyNumber: '0123456749',
            address: belgianAddress(),
        });
        const invoice = await buildInvoiceFor(company);

        const xml = await InvoiceXMlService.buildXml(invoice);

        expect(xml).toContain('<cbc:Name>Customer BV</cbc:Name>');
        // No custom PEPPOL id: the endpoint id is the derived KBO number.
        expect(xml).toContain('<cbc:EndpointID schemeID="0208">0123456749</cbc:EndpointID>');
        // The legal entity company id is the derived KBO number.
        expect(xml).toContain('<cbc:CompanyID schemeID="0208">0123456749</cbc:CompanyID>');
        // The VAT number is registered as a tax scheme.
        expect(xml).toContain('<cbc:CompanyID>BE0123456749</cbc:CompanyID>');
    });

    test('generates XML for a Belgian company with only a company number', async () => {
        const company = Company.create({
            name: 'Customer VZW',
            VATNumber: null,
            companyNumber: '0123456749',
            address: belgianAddress(),
        });
        const invoice = await buildInvoiceFor(company);

        const xml = await InvoiceXMlService.buildXml(invoice);

        expect(xml).toContain('<cbc:Name>Customer VZW</cbc:Name>');
        expect(xml).toContain('<cbc:EndpointID schemeID="0208">0123456749</cbc:EndpointID>');
        expect(xml).toContain('<cbc:CompanyID schemeID="0208">0123456749</cbc:CompanyID>');
        // No VAT number for this company: no customer VAT tax scheme.
        expect(xml).not.toContain('BE0123456749');
    });

    test('generates XML for a Belgian company with a VAT number and a custom PEPPOL id', async () => {
        const company = Company.create({
            name: 'Customer BV',
            VATNumber: 'BE0123456749',
            companyNumber: '0123456749',
            address: belgianAddress(),
            customPeppolEndpointId: PeppolEndointId.create({ schemeID: '0088', id: '5412345000013' }),
        });
        const invoice = await buildInvoiceFor(company);

        const xml = await InvoiceXMlService.buildXml(invoice);

        // The custom PEPPOL id is used as the delivery endpoint id.
        expect(xml).toContain('<cbc:EndpointID schemeID="0088">5412345000013</cbc:EndpointID>');
        // But the legal entity company id remains the derived KBO number.
        expect(xml).toContain('<cbc:CompanyID schemeID="0208">0123456749</cbc:CompanyID>');
        expect(xml).toContain('<cbc:CompanyID>BE0123456749</cbc:CompanyID>');
    });

    test('generates XML for a Belgian company with only a company number and a custom PEPPOL id', async () => {
        const company = Company.create({
            name: 'Customer VZW',
            VATNumber: null,
            companyNumber: '0123456749',
            address: belgianAddress(),
            customPeppolEndpointId: PeppolEndointId.create({ schemeID: '0060', id: '123456789' }),
        });
        const invoice = await buildInvoiceFor(company);

        const xml = await InvoiceXMlService.buildXml(invoice);

        expect(xml).toContain('<cbc:EndpointID schemeID="0060">123456789</cbc:EndpointID>');
        expect(xml).toContain('<cbc:CompanyID schemeID="0208">0123456749</cbc:CompanyID>');
        expect(xml).not.toContain('BE0123456749');
    });

    test('cannot generate XML for a company without a company number, even with a custom PEPPOL id', async () => {
        const company = Company.create({
            name: 'No Number',
            VATNumber: null,
            companyNumber: null,
            address: belgianAddress(),
            customPeppolEndpointId: PeppolEndointId.create({ schemeID: '0088', id: '5412345000013' }),
        });
        const invoice = await buildInvoiceFor(company);

        // The legal entity company id (peppolCompanyId) requires a VAT or company number,
        // so a custom endpoint id alone is not enough.
        await expect(InvoiceXMlService.buildXml(invoice)).rejects.toThrow('Missing customer peppol id');
    });
});
