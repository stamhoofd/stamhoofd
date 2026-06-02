import { BundleDiscountGroupPriceSettings } from './BundleDiscountGroupPriceSettings.js';
import { BundleDiscount } from './BundleDiscount.js';
import { GroupPriceDiscount, GroupPriceDiscountType } from './GroupPriceDiscount.js';
import { GroupPrice, GroupSettings } from './GroupSettings.js';
import { Group } from './Group.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from './RegistrationPeriod.js';
import { ReduceablePrice } from './ReduceablePrice.js';
import { TranslatedString } from './TranslatedString.js';

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
        expect(duplicatedBundleDiscount.id).toBe(bundleDiscount.id);
        expect(duplicatedBundleDiscount.name.toString()).toBe(bundleDiscount.name.toString());
        expect(duplicatedGroup.settings.prices[0].bundleDiscounts.has(bundleDiscount.id)).toBe(true);
    });
});
