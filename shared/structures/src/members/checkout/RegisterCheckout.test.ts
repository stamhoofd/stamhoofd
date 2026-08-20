import { BalanceItem } from '../../BalanceItem.js';
import { Organization } from '../../Organization.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../../RegistrationPeriod.js';
import { RegisterCheckout } from './RegisterCheckout.js';

function createOrganization() {
    return Organization.create({
        period: OrganizationRegistrationPeriod.create({
            period: RegistrationPeriod.create({}),
        }),
    });
}

function createBalanceItem(organization: Organization, unitPrice: number) {
    return BalanceItem.create({
        organizationId: organization.id,
        amount: 1,
        unitPrice,
    });
}

describe('RegisterCheckout', () => {
    describe('applyMaximumDiscounts', () => {
        test('keeps a negative balance item when paying an open balance that is net positive', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const b = createBalanceItem(organization, 20_0000);
            const c = createBalanceItem(organization, -10_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(a, 30_0000);
            checkout.addBalanceItem(b, 20_0000);
            checkout.addBalanceItem(c, -10_0000);

            checkout.updateBalances([a, b, c]);

            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 30_0000],
                [b.id, 20_0000],
                [c.id, -10_0000],
            ]);
            expect(checkout.totalPrice).toBe(40_0000);
        });

        test('caps the credit at the amount paid now', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const c = createBalanceItem(organization, -40_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(a, 30_0000);

            checkout.updateBalances([a, c]);

            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 30_0000],
                [c.id, -30_0000],
            ]);
            expect(checkout.totalPrice).toBe(0);
        });

        test('removes every adjacent negative balance item before recalculating', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 10_0000);
            const c1 = createBalanceItem(organization, -30_0000);
            const c2 = createBalanceItem(organization, -30_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(c1, -30_0000, { calculate: false });
            checkout.addBalanceItem(c2, -30_0000, { calculate: false });
            checkout.addBalanceItem(a, 10_0000, { calculate: false });

            checkout.updateBalances([a, c1, c2]);

            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 10_0000],
                [c1.id, -10_0000],
            ]);
            expect(checkout.totalPrice).toBe(0);
        });

        test('does not apply credit when the member still owes more than the credit', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const b = createBalanceItem(organization, 20_0000);
            const c = createBalanceItem(organization, -10_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(a, 30_0000);

            checkout.updateBalances([a, b, c]);

            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 30_0000],
            ]);
            expect(checkout.totalPrice).toBe(30_0000);
        });

        test('spreads the credit over multiple negative balance items', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 50_0000);
            const c1 = createBalanceItem(organization, -30_0000);
            const c2 = createBalanceItem(organization, -30_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(a, 50_0000);

            checkout.updateBalances([a, c1, c2]);

            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 50_0000],
                [c1.id, -30_0000],
                [c2.id, -20_0000],
            ]);
            expect(checkout.totalPrice).toBe(0);
        });

        test('counts the unpaid part of a partially paid balance item as open balance', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const c = createBalanceItem(organization, -20_0000);

            const checkout = new RegisterCheckout();
            checkout.setDefaultOrganization(organization);
            checkout.addBalanceItem(a, 10_0000);

            // 20 of a stays open, so only 20 - 20 = 0 remains: no credit applied
            checkout.updateBalances([a, c]);
            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 10_0000],
            ]);

            checkout.removeBalanceItemByBalance(a);
            checkout.addBalanceItem(a, 15_0000);

            // 15 stays open, so 5 of the credit is applied
            checkout.updateBalances([a, c]);
            expect(checkout.cart.balanceItems.map(i => [i.item.id, i.price])).toEqual([
                [a.id, 15_0000],
                [c.id, -5_0000],
            ]);
            expect(checkout.totalPrice).toBe(10_0000);
        });
    });

    describe('calculateAutomaticDiscounts', () => {
        test('previews the credit for the items that will be paid', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const b = createBalanceItem(organization, 20_0000);
            const c = createBalanceItem(organization, -10_0000);
            const otherOrganizationCredit = createBalanceItem(createOrganization(), -50_0000);

            const discounts = RegisterCheckout.calculateAutomaticDiscounts({
                organizationId: organization.id,
                balanceItems: [a, b, c, otherOrganizationCredit],
                payingNow: 50_0000,
                price: 50_0000,
            });

            expect([...discounts.entries()]).toEqual([[c, 10_0000]]);
        });

        test('applies nothing while more stays open than the credit', () => {
            const organization = createOrganization();
            const a = createBalanceItem(organization, 30_0000);
            const b = createBalanceItem(organization, 20_0000);
            const c = createBalanceItem(organization, -10_0000);

            const discounts = RegisterCheckout.calculateAutomaticDiscounts({
                organizationId: organization.id,
                balanceItems: [a, b, c],
                payingNow: 30_0000,
                price: 30_0000,
            });

            expect(discounts.size).toBe(0);
        });
    });
});
