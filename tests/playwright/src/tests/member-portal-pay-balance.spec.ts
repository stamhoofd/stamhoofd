// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, MemberFactory, OrganizationFactory, Payment } from '@stamhoofd/models';
import { BalanceItemType, PaymentStatus } from '@stamhoofd/structures';
import { MemberPortalRegistrationFlow } from '../flows/MemberPortalRegistrationFlow.js';
import { WorkerData } from '../helpers/index.js';

test.describe('Member portal - pay outstanding balance @member-portal-pay-balance', () => {
    let user: User;

    test.beforeAll(() => {
        user = WorkerData.user;
    });

    test.afterEach(async () => {
        await WorkerData.databaseHelper.clearMembers();
    });

    /**
     * The selection view and the cart render the same breakdown rows: a label in `.left`
     * followed by the price in the sibling `.right` cell.
     */
    async function expectBreakdownRow(scope: Locator, name: string, price: string) {
        const row = scope.locator('.pricing-box .left').filter({ has: scope.page().locator('h3 > span').getByText(name, { exact: true }) });
        await expect(row).toBeVisible();
        await expect(row.locator('xpath=following-sibling::div[1]')).toContainText(price);
    }

    test('a credit is deducted when paying an open balance', async ({ page, pages }) => {
        // Created per test so payments of a retried run don't pile up on the same organization
        const organization = await new OrganizationFactory({}).create();

        // The member owes 30 + 20 and has a credit of 10, so 40 has to be paid.
        const member = await new MemberFactory({ firstName: 'Balans', lastName: 'Betaler', user }).create();

        const itemA = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            type: BalanceItemType.Other,
            name: 'Kamp',
            amount: 1,
            unitPrice: 30_0000,
        }).create();

        const itemB = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            type: BalanceItemType.Other,
            name: 'Uniform',
            amount: 1,
            unitPrice: 20_0000,
        }).create();

        const credit = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            type: BalanceItemType.Other,
            name: 'Terugbetaling weekend',
            amount: 1,
            unitPrice: -10_0000,
        }).create();

        const flow = new MemberPortalRegistrationFlow({ page, pages });

        await test.step('open the outstanding balance and select the payable items', async () => {
            await pages.memberPortal.goto();
            await page.getByTestId('payments-button').click();
            await page.getByTestId('pay-balance-button').click();

            // Only the payable items are listed here; the credit that the cart will apply is previewed
            const selectionView = page.getByTestId('save-view');
            await expectBreakdownRow(selectionView, 'Subtotaal', '€ 50');
            await expectBreakdownRow(selectionView, 'Tegoed', '- € 10');
            await expectBreakdownRow(selectionView, 'Totaal', '€ 40');
            await selectionView.getByTestId('save-button').click();

            // close toast
            await page.getByTestId('toast-box').click();
        });

        await test.step('cart keeps the credit', async () => {
            const cartView = page.getByTestId('cart-view');
            await expectBreakdownRow(cartView, 'Subtotaal', '€ 50');
            await expectBreakdownRow(cartView, 'Tegoed', '- € 10');
            await expectBreakdownRow(cartView, 'Totaal', '€ 40');

            await cartView.getByTestId('go-to-checkout-button').click();
            await flow.expectTotalText('Totaal: € 40');
        });

        await test.step('payment is created for the net amount', async () => {
            await flow.confirmPaymentMethod();
            await flow.expectSuccessView();

            const payments = await Payment.select().where('organizationId', organization.id).fetch();
            expect(payments).toHaveLength(1);
            expect(payments[0].price).toBe(40_0000);
            // Point of sale payments stay pending until an admin marks them as paid
            expect(payments[0].status).toBe(PaymentStatus.Created);

            const balanceItemPayments = await BalanceItemPayment.select().where('paymentId', payments[0].id).fetch();
            const priceById = new Map(balanceItemPayments.map(p => [p.balanceItemId, p.price]));
            expect(priceById.get(itemA.id)).toBe(30_0000);
            expect(priceById.get(itemB.id)).toBe(20_0000);
            expect(priceById.get(credit.id)).toBe(-10_0000);

            const updatedCredit = await BalanceItem.getByID(credit.id);
            expect(updatedCredit!.pricePending).toBe(-10_0000);
            expect(updatedCredit!.priceOpen).toBe(0);
        });
    });
});
