import { Group, OrganizationRegistrationPeriod } from '@stamhoofd/models';
import { GroupPriceDiscountType, BundleDiscount, TranslatedString, GroupPriceDiscount, ReduceablePrice, GroupPrice, BundleDiscountGroupPriceSettings } from '@stamhoofd/structures';

function createBundleDiscount({
    name = 'Bundle discount',
    countWholeFamily = true,
    countPerGroup = false,
    discounts = [
        { value: 10_00, type: GroupPriceDiscountType.Fixed },
        { value: 15_00, type: GroupPriceDiscountType.Fixed },
    ],
}: {
    name?: string;
    countWholeFamily?: boolean;
    countPerGroup?: boolean;
    discounts?: Array<{ value: number; type: GroupPriceDiscountType; reducedValue?: number }>;
} = {}) {
    return BundleDiscount.create({
        name: new TranslatedString(name),
        countWholeFamily,
        countPerGroup,
        discounts: discounts.map(d => GroupPriceDiscount.create({
            value: ReduceablePrice.create({
                price: d.value,
                reducedPrice: d.reducedValue ?? null,
            }),
            type: d.type,
        })),
    });
}

export async function enableDiscount({ group, groupPrice, bundleDiscount }: { group: Group; groupPrice: GroupPrice; bundleDiscount: BundleDiscount }) {
    groupPrice.bundleDiscounts.set(bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
        name: bundleDiscount.name,
    }));
    await group.save();
}

/**
 * Create a bundle discount
 */
export async function initBundleDiscount({ organizationRegistrationPeriod, discount }: { organizationRegistrationPeriod: OrganizationRegistrationPeriod; discount: Parameters<typeof createBundleDiscount>[0] }) {
    const bundleDiscount = createBundleDiscount(discount);
    organizationRegistrationPeriod.settings.bundleDiscounts.push(bundleDiscount);
    await organizationRegistrationPeriod.save();
    return bundleDiscount;
}
