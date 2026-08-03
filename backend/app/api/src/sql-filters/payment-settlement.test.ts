import { compileToSQLFilter } from '@stamhoofd/sql';
import { PaymentMethod, PaymentProvider, PaymentStatus, Settlement } from '@stamhoofd/structures';
import { toBalanceItemFilter } from '@stamhoofd/structures/breakdown/breakdownFilters.js';
import type { SettleablePayment } from '@stamhoofd/structures/PaymentSettlement.js';
import { ACCOUNT_DEDUCTIONS_ID, FAILED_PAYMENT_ID, getPaymentSettlement, PENDING_PAYMENT_ID } from '@stamhoofd/structures/PaymentSettlement.js';
import { balanceItemFilterCompilers } from './balance-items.js';
import { paymentFilterCompilers } from './payments.js';

describe('paymentSettlementFilterCompilers', () => {
    const settlement = Settlement.create({
        id: 'settlement-1',
        reference: 'ST-2026-01',
        settledAt: new Date(2026, 0, 15),
        amount: 100_00,
    });

    /**
     * At least one payment for every group getPaymentSettlement can hand out, so a group that gets a new
     * field in its filter is covered here.
     */
    const payments: SettleablePayment[] = [
        // Money that never arrived
        { method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, settlement: null, status: PaymentStatus.Pending },
        { method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, settlement: null, status: PaymentStatus.Failed },
        // Paid out, and waiting to be paid out
        { method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, settlement, status: PaymentStatus.Succeeded },
        { method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, settlement: null, status: PaymentStatus.Succeeded },
        // Online, but from a provider that tells us nothing about its payouts
        { method: PaymentMethod.Payconiq, provider: PaymentProvider.Payconiq, settlement: null, status: PaymentStatus.Succeeded },
        { method: PaymentMethod.CreditCard, provider: null, settlement: null, status: PaymentStatus.Succeeded },
        // Never online
        { method: PaymentMethod.Transfer, provider: null, settlement: null, status: PaymentStatus.Succeeded },
        { method: PaymentMethod.PointOfSale, provider: null, settlement: null, status: PaymentStatus.Succeeded },
        { method: PaymentMethod.AccountDeductions, provider: null, settlement: null, status: PaymentStatus.Succeeded },
    ];

    const groups = payments.map(payment => getPaymentSettlement(payment));

    test('every payout group can be compiled against the payments table', async () => {
        for (const group of groups) {
            await expect(compileToSQLFilter(group.filter, paymentFilterCompilers)).resolves.toBeDefined();
        }
    });

    test('every payout group survives being asked about the balance items it paid for', async () => {
        // A balance item doesn't carry how it was paid, so the payout tab of a balance item breakdown
        // selects the items through their payments. A field that only the payments table knows about
        // would only break there, at runtime.
        for (const group of groups) {
            await expect(compileToSQLFilter(toBalanceItemFilter(group.filter), balanceItemFilterCompilers)).resolves.toBeDefined();
        }
    });

    test('covers every kind of payout group', () => {
        // Guards the fixtures above: a new kind of group has to be added here before it is covered
        expect([...new Set(groups.map(group => group.id))].sort()).toEqual([
            ACCOUNT_DEDUCTIONS_ID,
            FAILED_PAYMENT_ID,
            'no-payout-info-none',
            'no-payout-info-' + PaymentProvider.Payconiq,
            'not-settled',
            // Every method that brings money in outside a provider shares one group
            'offline',
            PENDING_PAYMENT_ID,
            'settlement-' + PaymentProvider.Stripe + '-' + settlement.reference + '-' + settlement.settledAt.getTime(),
        ].sort());
    });
});
