import { describe, it, expect } from 'vitest';
import { InvoiceCounter } from './InvoiceCounter.js';
import { OrganizationInvoiceSettings } from '@stamhoofd/structures/OrganizationInvoiceSettings.js';
import { Invoice } from '../models/Invoice.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';

// Minimal settings factory
function makeSettings(overrides: Partial<OrganizationInvoiceSettings> = {}): OrganizationInvoiceSettings {
    return OrganizationInvoiceSettings.create({
        resetMonth: null,
        prefixYear: false,
        ...overrides,
    })
}

// ─────────────────────────────────────────────
// parseNumber
// ─────────────────────────────────────────────
describe('InvoiceCounter.parseNumber', () => {
    describe('without year prefix', () => {
        const settings = makeSettings({ prefixYear: false });

        it('parses ABC-123 → 123', () => {
            expect(InvoiceCounter.parseNumber(settings, 'ABC-123')).toBe(123);
        });

        it('parses XXX0001 → 1', () => {
            expect(InvoiceCounter.parseNumber(settings, 'XXX0001')).toBe(1);
        });

        it('parses 05STA0001 → 1', () => {
            expect(InvoiceCounter.parseNumber(settings, '05STA0001')).toBe(1);
        });

        it('parses 1234-0011 → 11', () => {
            expect(InvoiceCounter.parseNumber(settings, '1234-0011')).toBe(11);
        });
    });

    describe('with year prefix (prefixYear: true)', () => {
        const settings = makeSettings({ prefixYear: true });

        it('parses 2012001584 → 1584', () => {
            expect(InvoiceCounter.parseNumber(settings, '2012001584')).toBe(1584);
        });

        it('parses XXX-2012001584 → 1584', () => {
            expect(InvoiceCounter.parseNumber(settings, 'XXX-2012001584')).toBe(1584);
        });
    });
});

describe('InvoiceCounter.formatNumber', () => {
    const date2025 = new Date('2025-06-15T12:00:00Z');

    it('formats 123 with fixed prefix ABC → "ABC000123"', () => {
        const settings = makeSettings({ fixedPrefix: 'ABC' });
        expect(InvoiceCounter.formatNumber(settings, 123, date2025)).toBe('ABC000123');
    });

    it('formats 123 with fixed prefix ABC1 → "ABC1-000123"', () => {
        const settings = makeSettings({ fixedPrefix: 'ABC1' });
        expect(InvoiceCounter.formatNumber(settings, 123, date2025)).toBe('ABC1-000123');
    });

    it('formats 1 with year prefix → "2025000001"', () => {
        const settings = makeSettings({ prefixYear: true });
        expect(InvoiceCounter.formatNumber(settings, 1, date2025)).toBe('2025000001');
    });

    it('formats 11 with fixed prefix "111-" and no duplicate dash → "111-000011"', () => {
        const settings = makeSettings({ fixedPrefix: '111-' });
        expect(InvoiceCounter.formatNumber(settings, 11, date2025)).toBe('111-000011');
    });

    it('formats 11 with fixed prefix "test-" and no duplicate dash → "test-000011"', () => {
        const settings = makeSettings({ fixedPrefix: 'test-' });
        expect(InvoiceCounter.formatNumber(settings, 11, date2025)).toBe('test-000011');
    });

    it('formats 54 with year prefix + fixed prefix → "ABC202500054"', () => {
        // year is prepended first, then fixedPrefix wraps around
        const settings = makeSettings({ prefixYear: true, fixedPrefix: 'ABC' });
        expect(InvoiceCounter.formatNumber(settings, 54, date2025)).toBe('ABC2025000054');
    });
});

describe('InvoiceCounter.shouldStartNewSeries', () => {
    it('returns false when resetMonth is null', () => {
        const settings = makeSettings({ resetMonth: null });
        const last = new Date('2024-12-01');
        const now = new Date('2025-06-01');
        expect(InvoiceCounter.shouldStartNewSeries(settings, last, now)).toBe(false);
    });

    it('returns true when crossing the reset month boundary', () => {
        // reset on January (month 1)
        const settings = makeSettings({ resetMonth: 1 });
        const last = new Date('2024-06-15');
        const now = new Date('2025-01-02');
        expect(InvoiceCounter.shouldStartNewSeries(settings, last, now)).toBe(true);
    });

    it('returns false when still within the same series period', () => {
        const settings = makeSettings({ resetMonth: 1 });
        const last = new Date('2025-01-05');
        const now = new Date('2025-06-01');
        expect(InvoiceCounter.shouldStartNewSeries(settings, last, now)).toBe(false);
    });
});

describe('InvoiceCounter.assignNextNumber', () => {
    beforeEach(() => {
        InvoiceCounter.clearAll();
        vitest.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
        vitest.useRealTimers();
    });

    it('assigns 000001 to the first invoice for an org (no cache, no DB)', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({});

        const invoice = new Invoice();
        invoice.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice, settings);

        expect(invoice.number).toBe('000001');
        expect(invoice.invoicedAt).not.toBeNull();
    });

    it('increments from cache when called twice without a reset boundary', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({});

        const invoice1 = new Invoice();
        invoice1.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice1, settings);
        expect(invoice1.number).toBe('000001');

        const invoice2 = new Invoice();
        invoice2.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice2, settings);
        expect(invoice2.number).toBe('000002');
    });

    it('continues from DB when cache is absent but a numbered invoice exists', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({});

        const existing = new Invoice();
        existing.organizationId = org.id;
        existing.number = '000042';
        existing.invoicedAt = new Date();
        await existing.save();

        InvoiceCounter.clearAll();

        const invoice = new Invoice();
        invoice.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice, settings);

        expect(invoice.number).toBe('000043');
    });

    it('starts a new series when the reset boundary is crossed (cache hit)', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({ resetMonth: 1, prefixYear: true });

        vitest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
        const invoice1 = new Invoice();
        invoice1.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice1, settings);
        expect(invoice1.number).toBe('2024000001');

        // Advance past the January 2025 reset boundary
        vitest.setSystemTime(new Date('2025-02-01T12:00:00Z'));
        const invoice2 = new Invoice();
        invoice2.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice2, settings);

        expect(invoice2.number).toBe('2025000001');
    });

    it('falls back to 1 when the DB invoice number cannot be parsed', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({});

        const existing = new Invoice();
        existing.organizationId = org.id;
        existing.number = 'INVALID';
        existing.invoicedAt = new Date();
        await existing.save();

        const invoice = new Invoice();
        invoice.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice, settings);

        expect(invoice.number).toBe('000001');
    });

    it('reads from DB after resetNumbers clears the cache', async () => {
        const org = await new OrganizationFactory({}).create();
        const settings = makeSettings({});

        const invoice1 = new Invoice();
        invoice1.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice1, settings);
        expect(invoice1.number).toBe('000001');

        await InvoiceCounter.resetNumbers(org.id);

        const invoice2 = new Invoice();
        invoice2.organizationId = org.id;
        await InvoiceCounter.assignNextNumber(invoice2, settings);
        expect(invoice2.number).toBe('000002');
    });
});
