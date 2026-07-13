import { BalanceItemType, BalanceItemWithPayments, BaseOrganization, DetailedPayableBalance } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import PayableBalanceTable from './PayableBalanceTable.vue';

function createItem(overrides: Partial<{ unitPrice: number; amount: number; VATPercentage: number | null; VATIncluded: boolean; description: string }> = {}) {
    return BalanceItemWithPayments.create({
        type: BalanceItemType.Other,
        description: overrides.description ?? 'Test item',
        amount: overrides.amount ?? 1,
        unitPrice: overrides.unitPrice ?? 4_13_00,
        VATPercentage: overrides.VATPercentage === undefined ? 21 : overrides.VATPercentage,
        VATIncluded: overrides.VATIncluded ?? false,
    });
}

function createBalance(balanceItems: BalanceItemWithPayments[]) {
    return DetailedPayableBalance.create({
        organization: BaseOrganization.create({ id: 'org' }),
        balanceItems,
    });
}

function renderTable(item: DetailedPayableBalance) {
    const present = vi.fn().mockResolvedValue(undefined);
    const result = render(PayableBalanceTable, {
        props: { item },
        global: {
            provide: {
                reactive_navigation_pop: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_dismiss: vi.fn().mockResolvedValue(undefined),
                reactive_navigation_present: present,
                reactive_navigation_push: vi.fn().mockResolvedValue(undefined),
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    $isMobile: false,
                    $context: null,
                    formatPrice: Formatter.price.bind(Formatter),
                    formatFloat: Formatter.float.bind(Formatter),
                    formatPercentage: Formatter.percentage.bind(Formatter),
                    formatPriceChange: Formatter.priceChange.bind(Formatter),
                    formatDate: Formatter.date.bind(Formatter),
                    formatDateRange: Formatter.dateRange.bind(Formatter),
                    formatStartDate: Formatter.startDate.bind(Formatter),
                } as any,
            },
            directives: {
                tooltip: {},
                copyable: {},
                autofocus: {},
            },
        },
    });
    return { result, present };
}

/**
 * The prices shown in the price breakdown box, trimmed.
 * Note: formatPrice renders '€' followed by a non-breaking space (\u00A0).
 */
function breakdownPrices(): (string | undefined)[] {
    return Array.from(document.querySelectorAll('.pricing-box .right')).map(el => el.textContent?.trim());
}

test('shows the empty state when there are no payable items', () => {
    renderTable(createBalance([]));
    expect(document.querySelector('.info-box')).not.toBeNull();
});

test('lists items excluding VAT and adds invoice-style VAT rows to the price breakdown', () => {
    // 4,13 excl. VAT + 21% -> 0,87 VAT -> 5,00 incl. VAT
    renderTable(createBalance([createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21, VATIncluded: false })]));

    // The item list shows the price excluding VAT, without the VAT mixed in
    const itemList = document.querySelector('.st-grid');
    expect(itemList).not.toBeNull();
    expect(itemList!.textContent).toContain('4,13');
    expect(itemList!.textContent).not.toContain('0,87');

    // The price breakdown shows: total excl. VAT / VAT (21%) / to pay — same as an invoice
    expect(document.querySelectorAll('.pricing-box .left')).toHaveLength(3);
    const box = document.querySelector('.pricing-box')!;
    expect(box.textContent).toContain('(21%)');
    expect(breakdownPrices()).toEqual(['€\u00A04,13', '€\u00A00,87', '€\u00A05']);

    // A single VAT rate needs no details action
    expect(box.querySelector('button.info-circle')).toBeNull();
});

test('the breakdown stays additive when partially paid', () => {
    // 5,00 excl. VAT + 21% -> 6,05 incl. VAT, of which 1,21 was already paid
    const item = createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 21, VATIncluded: false });
    item.pricePaid = 1_21_00;
    renderTable(createBalance([item]));

    // Every row follows from the rows above it:
    // total excl. VAT (5,00) + VAT (1,05) = total incl. VAT (6,05), minus paid (1,21) = to pay (4,84)
    expect(breakdownPrices()).toEqual(['\u20AC\u00A05', '\u20AC\u00A01,05', '\u20AC\u00A06,05', '\u20AC\u00A01,21', '\u20AC\u00A04,84']);
});

test('VAT-inclusive items in the same basket also show unit prices excluding VAT', () => {
    // The excl. VAT item switches the list to prices excluding VAT; the VAT-inclusive item
    // (2 x 12,10 incl. 21% VAT) must then show its unit price excluding VAT (10,00) too
    renderTable(createBalance([
        createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21, VATIncluded: false }),
        createItem({ unitPrice: 12_10_00, amount: 2, VATPercentage: 21, VATIncluded: true, description: 'Inclusive item' }),
    ]));

    const itemList = document.querySelector('.st-grid')!;
    expect(itemList.textContent).toContain('\u20AC\u00A010');
    expect(itemList.textContent).not.toContain('12,10');
});

test('shows an info action with the VAT details when there are multiple VAT rates', async () => {
    const { present } = renderTable(createBalance([
        createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21 }),
        createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 6 }),
    ]));

    const box = document.querySelector('.pricing-box')!;

    // No single percentage in the VAT row name
    expect(box.textContent).not.toContain('(21%)');
    expect(box.textContent).not.toContain('(6%)');

    // The info action opens the per-rate VAT details sheet
    const button = box.querySelector<HTMLButtonElement>('button.info-circle');
    expect(button).not.toBeNull();
    await userEvent.click(button!);
    expect(present).toHaveBeenCalled();
});

test('does not add VAT rows when there are no VAT rates', () => {
    renderTable(createBalance([createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: null })]));

    // Only the 'to pay' row remains
    expect(document.querySelectorAll('.pricing-box .left')).toHaveLength(1);
    expect(breakdownPrices()).toEqual(['€\u00A04,13']);
});

test('does not add VAT rows when VAT is included in the price', () => {
    renderTable(createBalance([createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 21, VATIncluded: true })]));

    expect(document.querySelectorAll('.pricing-box .left')).toHaveLength(1);
    expect(breakdownPrices()).toEqual(['€\u00A05']);
});

test('emits checkout when the pay button is clicked', async () => {
    const { result } = renderTable(createBalance([createItem()]));

    await userEvent.click(document.querySelector('.style-button-bar button')!);

    expect(result.emitted()).toHaveProperty('checkout');
});
