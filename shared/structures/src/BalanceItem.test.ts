import { TestUtils } from '@stamhoofd/test-utils';
import { BalanceItem, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, getApplicableBalanceItemRelationTypes, getApplicableBalanceItemTypes, GroupedBalanceItems, VATExcemptReason } from './BalanceItem.js';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { TranslatedString } from './TranslatedString.js';
import { DetailedPayableBalance } from './endpoints/PayableBalanceCollection.js';
import { BaseOrganization, Organization } from './Organization.js';
import { Platform } from './Platform.js';

/**
 * Helper to create a payable (Due) balance item with an exclusive VAT rate.
 * unitPrice is in the internal integer format (1 euro = 10000).
 */
function createItem(overrides: Partial<{ unitPrice: number; amount: number; VATPercentage: number | null; VATIncluded: boolean; VATExcempt: VATExcemptReason | null; type: BalanceItemType; description: string }> = {}) {
    return BalanceItemWithPayments.create({
        type: overrides.type ?? BalanceItemType.Other,
        description: overrides.description ?? 'Test item',
        amount: overrides.amount ?? 1,
        unitPrice: overrides.unitPrice ?? 4_13_00,
        VATPercentage: overrides.VATPercentage === undefined ? 21 : overrides.VATPercentage,
        VATIncluded: overrides.VATIncluded ?? false,
        VATExcempt: overrides.VATExcempt ?? null,
    });
}

describe('getApplicableBalanceItemTypes / getApplicableBalanceItemRelationTypes', () => {
    const membershipOrganization = Organization.create({ id: 'membership-org' });
    const otherOrganization = Organization.create({ id: 'other-org' });
    const platform = Platform.create({ membershipOrganizationId: 'membership-org' });

    describe('a regular organization (organization mode, not the membership organization)', () => {
        test('hides Stamhoofd billing and platform membership items', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'stamhoofd');

            const types = getApplicableBalanceItemTypes(otherOrganization, platform);
            expect(types).not.toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.ServiceFee);
            expect(types).not.toContain(BalanceItemType.TransferFee);
            expect(types).not.toContain(BalanceItemType.ReferralDiscount);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);
            expect(types).toContain(BalanceItemType.Registration);

            const relations = getApplicableBalanceItemRelationTypes(otherOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
            expect(relations).not.toContain(BalanceItemRelationType.STPricingType);
            expect(relations).not.toContain(BalanceItemRelationType.PaymentProvider);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
            expect(relations).toContain(BalanceItemRelationType.Group);
        });
    });

    describe('the Stamhoofd membership organization (organization mode)', () => {
        test('shows Stamhoofd billing items but still hides the platform membership', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            // Comparison is case-insensitive
            TestUtils.setEnvironment('platformName', 'Stamhoofd');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).toContain(BalanceItemType.STPackage);
            expect(types).toContain(BalanceItemType.ServiceFee);
            expect(types).toContain(BalanceItemType.TransferFee);
            expect(types).toContain(BalanceItemType.ReferralDiscount);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).toContain(BalanceItemRelationType.STPackage);
            expect(relations).toContain(BalanceItemRelationType.STPricingType);
            expect(relations).toContain(BalanceItemRelationType.PaymentProvider);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
        });

        test('hides Stamhoofd billing items on a non-Stamhoofd platform', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('the membership organization (platform mode)', () => {
        test('shows the platform membership but hides Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(membershipOrganization, platform);
            expect(types).toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.ServiceFee);

            const relations = getApplicableBalanceItemRelationTypes(membershipOrganization, platform);
            expect(relations).toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('a non-membership organization (platform mode)', () => {
        test('hides both the platform membership and Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(otherOrganization, platform);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(otherOrganization, platform);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });

    describe('a platform-wide view (null organization, treated as the membership organization)', () => {
        test('in organization mode on the Stamhoofd platform, shows Stamhoofd billing items but not the platform membership', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            TestUtils.setEnvironment('platformName', 'stamhoofd');

            const types = getApplicableBalanceItemTypes(null, platform);
            expect(types).toContain(BalanceItemType.STPackage);
            expect(types).not.toContain(BalanceItemType.PlatformMembership);

            const relations = getApplicableBalanceItemRelationTypes(null, platform);
            expect(relations).toContain(BalanceItemRelationType.STPackage);
            expect(relations).not.toContain(BalanceItemRelationType.MembershipType);
        });

        test('in platform mode, shows the platform membership but not Stamhoofd billing items', () => {
            TestUtils.setEnvironment('userMode', 'platform');
            TestUtils.setEnvironment('platformName', 'My platform');

            const types = getApplicableBalanceItemTypes(null, platform);
            expect(types).toContain(BalanceItemType.PlatformMembership);
            expect(types).not.toContain(BalanceItemType.STPackage);

            const relations = getApplicableBalanceItemRelationTypes(null, platform);
            expect(relations).toContain(BalanceItemRelationType.MembershipType);
            expect(relations).not.toContain(BalanceItemRelationType.STPackage);
        });
    });
});

describe('BalanceItem.getPayableVATBreakdown', () => {
    test('groups the VAT per rate and sums the taxable price and VAT', () => {
        const items = [
            createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21 }), // taxable 41300, VAT 8673
            createItem({ unitPrice: 10_00_00, amount: 2, VATPercentage: 21 }), // taxable 200000, VAT 42000
            createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 6 }), // taxable 50000, VAT 3000
        ];

        const breakdown = BalanceItem.getPayableVATBreakdown(items);

        // Sorted descending by percentage
        expect(breakdown).toEqual([
            { VATPercentage: 21, VATExcempt: null, taxablePrice: 41300 + 200000, VAT: 8673 + 42000 },
            { VATPercentage: 6, VATExcempt: null, taxablePrice: 50000, VAT: 3000 },
        ]);
    });

    test('ignores items without a VAT rate or exemption', () => {
        const items = [
            createItem({ unitPrice: 3_00_00, VATPercentage: null }),
        ];

        expect(BalanceItem.getPayableVATBreakdown(items)).toEqual([]);
    });

    test('groups exempt items per exemption reason with a 0% rate, like on invoices', () => {
        // Two exempt items with different underlying rates end up in one 0% group
        const items = [
            createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 21, VATExcempt: VATExcemptReason.IntraCommunityServices }),
            createItem({ unitPrice: 3_00_00, amount: 1, VATPercentage: 6, VATExcempt: VATExcemptReason.IntraCommunityServices }),
        ];

        expect(BalanceItem.getPayableVATBreakdown(items)).toEqual([
            { VATPercentage: 0, VATExcempt: VATExcemptReason.IntraCommunityServices, taxablePrice: 80000, VAT: 0 },
        ]);
    });

    test('is based on the full payable price, so payments do not change it', () => {
        // 5,00 excl. VAT + 21% -> 6,05 incl. VAT, partially paid
        const item = createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 21 });
        item.pricePaid = 1_21_00;

        expect(BalanceItem.getPayableVATBreakdown([item])).toEqual([
            // Payments are shown as separate breakdown rows; the VAT reconciles with the total incl. VAT
            { VATPercentage: 21, VATExcempt: null, taxablePrice: 50000, VAT: 10500 },
        ]);
    });

    test('hidden and canceled items add nothing', () => {
        const item = createItem({ unitPrice: 5_00_00, amount: 1, VATPercentage: 21 });
        item.status = BalanceItemStatus.Canceled;

        expect(BalanceItem.getPayableVATBreakdown([item])).toEqual([]);
    });
});

describe('GroupedBalanceItems.payablePriceWithoutVAT', () => {
    test('sums the prices excluding VAT of all items in the group', () => {
        const groups = GroupedBalanceItems.group([
            createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21 }),
            createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21 }),
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].payablePriceWithoutVAT).toBe(2 * 41300);
        // The full price (including VAT) is still available and larger
        expect(groups[0].payablePriceWithVAT).toBe(2 * 49973);
    });

    test('unitPriceWithoutVAT strips the VAT from the unit price of VAT-inclusive items', () => {
        // 12,10 incl. 21% VAT per piece -> 10,00 excl. VAT per piece
        const item = createItem({ unitPrice: 12_10_00, amount: 2, VATPercentage: 21, VATIncluded: true });
        expect(item.unitPriceWithoutVAT).toBe(10_00_00);
        expect(item.unitPriceWithVAT).toBe(12_10_00);

        const groups = GroupedBalanceItems.group([item]);
        expect(groups[0].unitPriceWithoutVAT).toBe(10_00_00);
    });

    test('does not count hidden or canceled items, mirroring payablePriceWithVAT', () => {
        const group = new GroupedBalanceItems();
        group.add(createItem({ unitPrice: 4_13_00, amount: 1, VATPercentage: 21 })); // Due
        group.add(BalanceItemWithPayments.create({
            type: BalanceItemType.Other,
            amount: 1,
            unitPrice: 4_13_00,
            VATPercentage: 21,
            VATIncluded: false,
            status: BalanceItemStatus.Canceled,
        }));

        // Only the Due item contributes to both payable prices
        expect(group.payablePriceWithoutVAT).toBe(41300);
        expect(group.payablePriceWithVAT).toBe(49973);
    });
});

describe('DetailedPayableBalance VAT helpers', () => {
    function createBalance(balanceItems: BalanceItemWithPayments[]) {
        return DetailedPayableBalance.create({
            organization: BaseOrganization.create({ id: 'org' }),
            balanceItems,
        });
    }

    test('detects exclusive VAT items', () => {
        const balance = createBalance([createItem({ VATPercentage: 21, VATIncluded: false })]);
        expect(balance.hasExclusiveVAT).toBe(true);
        expect(balance.VATBreakdown).toHaveLength(1);
    });

    test('does not treat VAT-inclusive items as exclusive VAT', () => {
        const balance = createBalance([createItem({ VATPercentage: 21, VATIncluded: true })]);
        expect(balance.hasExclusiveVAT).toBe(false);
    });

    test('has no exclusive VAT and no breakdown when there are no VAT rates', () => {
        const balance = createBalance([createItem({ VATPercentage: null })]);
        expect(balance.hasExclusiveVAT).toBe(false);
        expect(balance.VATBreakdown).toEqual([]);
    });
});

describe('BalanceItem.categoryFilter / articleFilter', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        TestUtils.setEnvironment('platformName', 'stamhoofd');
    });

    function createItem(type: BalanceItemType, relations: [BalanceItemRelationType, string][] = [], description = '') {
        return BalanceItem.create({
            type,
            description,
            relations: new Map(relations.map(([relationType, id]) => [
                relationType,
                BalanceItemRelation.create({ id, name: new TranslatedString(id) }),
            ])),
        });
    }

    /**
     * A filter is a list of conditions that all have to hold, which is what an item matches when it has
     * exactly the values they ask for.
     */
    function matches(filter: StamhoofdFilter, item: BalanceItem): boolean {
        const conditions = (filter as { $and: Record<string, any>[] }).$and;

        return conditions.every((condition) => {
            if ('type' in condition) {
                return condition.type === item.type;
            }

            if ('description' in condition) {
                return condition.description === item.description;
            }

            const [relationType, expected] = Object.entries(condition.relations as Record<string, { id: string | null }>)[0];
            return (item.relations.get(relationType as BalanceItemRelationType)?.id ?? null) === expected.id;
        });
    }

    describe('categoryFilter selects exactly the items with the same categoryId', () => {
        test('a cancellation fee without any relation does not select the ones that have one', () => {
            const bare = createItem(BalanceItemType.CancellationFee);
            const forGroup = createItem(BalanceItemType.CancellationFee, [[BalanceItemRelationType.Group, 'group-a']]);
            const forWebshop = createItem(BalanceItemType.CancellationFee, [[BalanceItemRelationType.Webshop, 'shop-a']]);

            expect(new Set([bare.categoryId, forGroup.categoryId, forWebshop.categoryId]).size).toBe(3);

            for (const item of [bare, forGroup, forWebshop]) {
                for (const other of [bare, forGroup, forWebshop]) {
                    expect(matches(item.categoryFilter, other)).toBe(item.categoryId === other.categoryId);
                }
            }
        });

        test('a cancellation fee is named after its group, so its webshop is not part of the category', () => {
            const forGroup = createItem(BalanceItemType.CancellationFee, [[BalanceItemRelationType.Group, 'group-a']]);
            const forBoth = createItem(BalanceItemType.CancellationFee, [[BalanceItemRelationType.Group, 'group-a'], [BalanceItemRelationType.Webshop, 'shop-a']]);

            expect(forBoth.categoryId).toBe(forGroup.categoryId);
            expect(matches(forGroup.categoryFilter, forBoth)).toBe(true);
        });
    });

    describe('articleFilter selects exactly the items with the same articleCode', () => {
        test('an administration fee with a description is a different article than one without', () => {
            const named = createItem(BalanceItemType.AdministrationFee, [], 'Kosten');
            const unnamed = createItem(BalanceItemType.AdministrationFee);

            expect(named.articleCode).not.toBe(unnamed.articleCode);
            expect(matches(named.articleFilter, unnamed)).toBe(false);
            expect(matches(unnamed.articleFilter, named)).toBe(false);
        });

        test('a registration is not told apart by its description', () => {
            const first = createItem(BalanceItemType.Registration, [[BalanceItemRelationType.Group, 'group-a']], 'Inschrijving Kapoenen');
            const second = createItem(BalanceItemType.Registration, [[BalanceItemRelationType.Group, 'group-a']], 'Inschrijving Kapoenen 2026');

            expect(first.articleCode).toBe(second.articleCode);
            expect(matches(first.articleFilter, second)).toBe(true);
        });
    });
});
