import { Migration } from '@simonbackx/simple-database';
import { Group, OrganizationRegistrationPeriod } from '@stamhoofd/models';
import { BundleDiscount, BundleDiscountGroupPriceSettings, GroupPrice, GroupPriceDiscount, GroupPriceDiscountType, GroupStatus, OldGroupPrices, ReduceablePrice, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

function getParentCategory(group: Group, period: OrganizationRegistrationPeriod) {
    const parent = group.getParentCategories(period.settings.categories)[0];
    if (!parent) {
        return null;
    }
    return parent;
}

async function migratePrices() {
    for await (const period of OrganizationRegistrationPeriod.select().all()) {
        // key = group category id
        const bundleMap = new Map<string, BundleDiscount[]>();
        const allBundleDiscounts: BundleDiscount[] = [];

        for await (const group of Group.select().where('periodId', period.periodId).andWhere('organizationId', period.organizationId).all()) {
            // if already migrated
            if (group.settings.prices.length > 0) {
                if (group.settings.oldPrices.length > 0) {
                    group.settings.oldPrices = [];
                    await group.save();
                }
                continue;
            }

            // if archived
            if (group.status === GroupStatus.Archived || group.deletedAt !== null) {
                group.settings.oldPrices = [];
                group.settings.prices = [
                    GroupPrice.create({
                        name: new TranslatedString('Standaard tarief'),
                        startDate: null,
                        endDate: null,
                        price: ReduceablePrice.create({
                            price: 0,
                            reducedPrice: null,
                        }),
                    }),
                ];

                await group.save();
                continue;
            }

            const oldPrices = group.settings.oldPrices;

            if (oldPrices.length === 0) {
                group.settings.prices = [
                    GroupPrice.create({
                        name: new TranslatedString('Standaard tarief'),
                        startDate: null,
                        endDate: null,
                        price: ReduceablePrice.create({
                            price: 0,
                            reducedPrice: null,
                        }),
                    }),
                ];

                await group.save();
                continue;
            }

            const prices: GroupPrice[] = [];

            const parentCategory = getParentCategory(group, period);
            const parentCategoryId = parentCategory?.id ?? '';
            // todo: rename
            const parentCategoryName = parentCategory?.settings.name ?? 'andere';

            for (let i = 0; i < oldPrices.length; i++) {
                const current: OldGroupPrices = oldPrices[i];
                const next: OldGroupPrices | undefined = oldPrices[i + 1];
                const { groupPrice, bundleDiscount } = convertOldGroupPricesHelper(group, parentCategoryId, parentCategoryName, bundleMap, current, next);
                prices.push(groupPrice);
                if (bundleDiscount) {
                    allBundleDiscounts.push(bundleDiscount);
                }
            }

            if (prices.length === 0) {
                throw new Error('prices empty');
            }

            group.settings.prices = prices;

            group.settings.oldPrices = [];

            await group.save();
        }

        if (allBundleDiscounts.length) {
            period.settings.bundleDiscounts = [...allBundleDiscounts];
            await period.save();
        }
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await migratePrices();
});

// copied from v1 code
function formatDate(date: Date) {
    const time = Formatter.time(date);
    if (time === '0:00') {
        return Formatter.date(date);
    }
    return Formatter.dateTime(date);
}

function convertOldGroupPricesHelper(group: Group, parentCategoryId: string, parentCategoryName: string, bundleMap: Map<string, BundleDiscount[]>, oldPrices: OldGroupPrices, next?: OldGroupPrices):
{ groupPrice: GroupPrice; bundleDiscount: BundleDiscount | null } {
    const firstPrice = oldPrices.prices[0];

    const groupPrice = GroupPrice.create({
        name: new TranslatedString(oldPrices.startDate === null
            ? 'Standaard tarief'
            : `Vanaf ${formatDate(oldPrices.startDate)}`),
        startDate: oldPrices.startDate ? new Date(oldPrices.startDate) : null,
        endDate: next?.startDate ? new Date(next.startDate.getTime() - 1) : null,
        price: ReduceablePrice.create({
            price: firstPrice.price,
            reducedPrice: firstPrice.reducedPrice,
        }),
    });

    const oldGroupPrices = oldPrices.prices;

    if (oldGroupPrices.length === 1) {
        return { groupPrice, bundleDiscount: null };
    }

    const countWholeFamily = oldPrices.sameMemberOnlyDiscount;
    const countPerGroup = oldPrices.onlySameGroup;

    const bundleDiscountsFromCategory = bundleMap.get(parentCategoryId) ?? [];

    const baseReducedPrice = firstPrice.reducedPrice === null ? firstPrice.price : firstPrice.reducedPrice;

    const discounts: GroupPriceDiscount[] = [];

    // skip first one
    for (let i = 1; i < oldGroupPrices.length; i++) {
        const oldGroupPrice = oldGroupPrices[i];

        const reducedPrice: number = oldGroupPrice.reducedPrice === null ? oldGroupPrice.price : oldGroupPrice.reducedPrice;

        const discount = GroupPriceDiscount.create({
            type: GroupPriceDiscountType.Fixed,
            value: ReduceablePrice.create({
                price: Math.max(0, firstPrice.price - oldGroupPrice.price),
                reducedPrice: Math.max(0, baseReducedPrice - reducedPrice),
            }),
        });
        discounts.push(discount);
    }

    const baseNameText = countWholeFamily ? 'Korting voor extra gezinslid' : 'Korting voor meerdere inschrijvingen';
    const nameText = oldPrices.onlySameGroup ? baseNameText : `${parentCategoryName} - ${baseNameText}`;

    const bundleDiscount = BundleDiscount.create({
        name: new TranslatedString(nameText),
        discounts,
        countWholeFamily,
        countPerGroup,
    });

    const categoryDiscount = findCategoryDiscount(bundleDiscount, bundleDiscountsFromCategory);

    if (categoryDiscount) {
        groupPrice.bundleDiscounts = new Map([
            [
                categoryDiscount.id,
                BundleDiscountGroupPriceSettings.create({
                    name: categoryDiscount.name,
                    // set custom discounts if discounts are different
                    customDiscounts: areDiscountsEqual(categoryDiscount.discounts, discounts) ? undefined : discounts,
                }),
            ],
        ]);

        bundleDiscountsFromCategory.forEach((d) => {
            if (groupPrice.bundleDiscounts.has(d.id)) {
                return;
            }

            groupPrice.bundleDiscounts.set(d.id, BundleDiscountGroupPriceSettings.create({
                name: d.name,
            }));
        });

        // bundle discounts exists already
        return { groupPrice, bundleDiscount: null };
    }

    const key = oldPrices.onlySameGroup ? parentCategoryId : '';

    if (bundleMap.has(key)) {
        const existing = bundleMap.get(key)!;
        existing.push(bundleDiscount);
    }
    else {
        bundleMap.set(key, [bundleDiscount]);
    }

    groupPrice.bundleDiscounts = new Map([
        [
            bundleDiscount.id,
            BundleDiscountGroupPriceSettings.create({
                name: bundleDiscount.name,
            }),
        ],
    ]);

    bundleDiscountsFromCategory.forEach((d) => {
        if (groupPrice.bundleDiscounts.has(d.id)) {
            return;
        }

        groupPrice.bundleDiscounts.set(d.id, BundleDiscountGroupPriceSettings.create({
            name: d.name,
        }));
    });

    return { groupPrice, bundleDiscount };
}

function findCategoryDiscount(discount: BundleDiscount, bundleDiscounts: BundleDiscount[]): BundleDiscount | null {
    return bundleDiscounts.find(d => d.countPerGroup === discount.countPerGroup && d.countWholeFamily === discount.countWholeFamily) ?? null;
}

function areDiscountsEqual(a: GroupPriceDiscount[], b: GroupPriceDiscount[]) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        const discountA = a[i];
        const discountB = b[i];

        if (discountA.type !== discountB.type) {
            return false;
        }

        if (discountA.value.price !== discountB.value.price) {
            return false;
        }

        if (discountA.value.reducedPrice !== discountB.value.reducedPrice) {
            return false;
        }
    }

    return true;
}
