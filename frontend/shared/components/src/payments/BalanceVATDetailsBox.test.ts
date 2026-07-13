import type { BalanceItemVATSubtotal } from '@stamhoofd/structures';
import { getVATExcemptInvoiceNote, VATExcemptReason } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import BalanceVATDetailsBox from './BalanceVATDetailsBox.vue';

function renderBox(vatBreakdown: BalanceItemVATSubtotal[]) {
    return render(BalanceVATDetailsBox, {
        props: { vatBreakdown },
        global: {
            provide: {
                // Render as a popup so the navigation bar (with its own dependencies) is skipped
                reactive_popup: {},
            },
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                    formatPrice: Formatter.price.bind(Formatter),
                    formatPercentage: Formatter.percentage.bind(Formatter),
                } as any,
            },
        },
    });
}

test('lists the taxable amount and VAT per rate', () => {
    renderBox([
        { VATPercentage: 21, VATExcempt: null, taxablePrice: 4_13_00, VAT: 86_73 },
        { VATPercentage: 6, VATExcempt: null, taxablePrice: 5_00_00, VAT: 30_00 },
    ]);

    // First grid item is the header row
    const rows = Array.from(document.querySelectorAll('.st-grid-item')).slice(1);
    expect(rows).toHaveLength(2);

    expect(rows[0].textContent).toContain('21%');
    expect(rows[0].textContent).toContain('4,13');
    expect(rows[0].textContent).toContain('0,87');

    expect(rows[1].textContent).toContain('6%');
    expect(rows[1].textContent).toContain('\u20AC\u00A05');
    expect(rows[1].textContent).toContain('0,30');
});

test('shows the exemption note for exempt groups', () => {
    renderBox([
        { VATPercentage: 0, VATExcempt: VATExcemptReason.IntraCommunityServices, taxablePrice: 5_00_00, VAT: 0 },
    ]);

    const row = Array.from(document.querySelectorAll('.st-grid-item'))[1];
    expect(row.textContent).toContain(getVATExcemptInvoiceNote(VATExcemptReason.IntraCommunityServices));
    expect(row.textContent).toContain('(0%)');
});
