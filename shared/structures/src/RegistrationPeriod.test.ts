import { BundleDiscountGroupPriceSettings } from './BundleDiscountGroupPriceSettings.js';
import { BundleDiscount } from './BundleDiscount.js';
import { GroupPriceDiscount, GroupPriceDiscountType } from './GroupPriceDiscount.js';
import { GroupPrice, GroupSettings } from './GroupSettings.js';
import { Group } from './Group.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from './RegistrationPeriod.js';
import { ReduceablePrice } from './ReduceablePrice.js';
import { TranslatedString } from './TranslatedString.js';

describe('RegistrationPeriodBase naming', () => {
    test.each([
        ['Gearchiveerde periodes', 'Gearchiveerde periodes', null, 'Gearchiveerde periodes'],
        ['Jaar 2025', 'Jaar', '2025', '2025'],
        ['Periode 2025-2026', 'Periode', '2025-2026', '2025-2026'],
        ['Periode 2025 - 2026', 'Periode', '2025 - 2026', '2025 - 2026'],
        ['Periode 25-26', 'Periode', '25-26', '25-26'],
        ['Periode 25 - 26', 'Periode', '25 - 26', '25 - 26'],
        ['Test 27', 'Test', '27', '27'],
    ])('splits custom name %s', (customName, prefix, suffix, nameShort) => {
        const period = RegistrationPeriod.create({
            customName,
        });

        expect(period.prefix).toBe(prefix);
        expect(period.suffix).toBe(suffix);
        expect(period.nameShort).toBe(nameShort);
    });
});

describe('OrganizationRegistrationPeriod.duplicate', () => {
    it('copies bundle discounts when duplicating to a new registration period', () => {
        const period = RegistrationPeriod.create({
            startDate: new Date(2025, 0, 1),
            endDate: new Date(2025, 11, 31),
        });
        const newPeriod = RegistrationPeriod.create({
            startDate: new Date(2026, 0, 1),
            endDate: new Date(2026, 11, 31),
        });

        const organizationPeriod = OrganizationRegistrationPeriod.create({
            period,
        });
        const bundleDiscount = BundleDiscount.create({
            name: new TranslatedString('Bundle discount'),
            discounts: [
                GroupPriceDiscount.create({
                    value: ReduceablePrice.create({
                        price: 10_00,
                    }),
                    type: GroupPriceDiscountType.Fixed,
                }),
            ],
        });
        const group = Group.create({
            periodId: period.id,
            settings: GroupSettings.create({
                prices: [
                    GroupPrice.create({}),
                ],
            }),
        });

        organizationPeriod.groups = [group];
        organizationPeriod.settings.categories[0].groupIds = [group.id];
        organizationPeriod.settings.bundleDiscounts = [bundleDiscount];
        group.settings.prices[0].bundleDiscounts.set(bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
            name: bundleDiscount.name,
        }));

        const duplicate = organizationPeriod.duplicate(newPeriod);
        const duplicatedGroup = duplicate.groups[0];
        const duplicatedBundleDiscount = duplicate.settings.bundleDiscounts[0];

        expect(duplicate.settings.bundleDiscounts).toHaveLength(1);
        expect(duplicatedBundleDiscount).not.toBe(bundleDiscount);
        expect(duplicatedBundleDiscount.id).not.toBe(bundleDiscount.id);
        expect(duplicatedBundleDiscount.name.toString()).toBe(bundleDiscount.name.toString());
        // The group price link must be remapped to the new discount id
        expect(duplicatedGroup.settings.prices[0].bundleDiscounts.has(bundleDiscount.id)).toBe(false);
        expect(duplicatedGroup.settings.prices[0].bundleDiscounts.has(duplicatedBundleDiscount.id)).toBe(true);
    });
});
