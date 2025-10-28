import { Migration } from '@simonbackx/simple-database';
import { Group, OrganizationRegistrationPeriod } from '@stamhoofd/models';
import { BundleDiscount, BundleDiscountGroupPriceSettings, GroupCategory, GroupPrice, GroupPriceDiscount, GroupPriceDiscountType, GroupStatus, GroupType, OldGroupPrice, OldGroupPrices, ReduceablePrice, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

const UNNASSIGNED_KEY = 'unassigned';

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

export async function migratePrices() {
    for await (const period of OrganizationRegistrationPeriod.select().all()) {
        // groups
        const allGroups = await Group.select()
            .where('periodId', period.periodId)
            .andWhere('organizationId', period.organizationId)
            .fetch();

        if (allGroups.every(g => g.settings.prices.length > 0)) {
            // already migrated
            console.log('Skipping period (already migrated): ' + period.id);
            continue;
        }

        // make sure bundle discounts are empty (just in case, if previous migration failed)
        period.settings.bundleDiscounts = [];

        const filteredGroups: Group[] = [];
        const archivedGroups: Group[] = [];

        // filter relevant groups, cleanup other groups
        for (const group of allGroups) {
            // make sure prices are empty (just in case, if previous migration failed)
            group.settings.prices = [GroupPrice.create({})];

            if (group.type !== GroupType.Membership || group.deletedAt !== null) {
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
            }
            else if (group.status === GroupStatus.Archived) {
                archivedGroups.push(group);
            }
            else {
                filteredGroups.push(group);
            }
        }

        // group by category
        const categoryMap = createCategoryMap(filteredGroups, archivedGroups, period.settings.categories);
        const allBundleDiscounts: BundleDiscount[] = [];

        // loop categories
        for (const [categoryId, groups] of categoryMap.entries()) {
            const category: GroupCategory | undefined = period.settings.categories.find(c => c.id === categoryId)!;
            const isUnassigned = categoryId === UNNASSIGNED_KEY;
            let categoryDiscountForFamily: BundleDiscount | null = null;
            let categoryDiscountForMember: BundleDiscount | null = null;

            // first find category discounts
            if (!isUnassigned) {
                for (const group of groups) {
                    if (group.settings.prices.length > 1 || (group.settings.prices.length === 1 && group.settings.prices[0].bundleDiscounts.size > 0)) {
                        // should never happen because prices are reset
                        throw new Error('Prices are not empty: ' + group.id);
                    }

                    // sorted old prices
                    const oldPricesArray = group.settings.oldPrices.slice().sort((a, b) => {
                        if (a.startDate === null) {
                            return -1;
                        }
                        if (b.startDate === null) {
                            return 1;
                        }
                        return a.startDate.getTime() - b.startDate.getTime();
                    });

                    for (const oldPrices of oldPricesArray) {
                        if (oldPrices.prices.length < 2) {
                            continue;
                        }

                        if (oldPrices.onlySameGroup) {
                            continue;
                        }

                        const countWholeFamily = !oldPrices.sameMemberOnlyDiscount;
                        const isCategoryDiscount = !oldPrices.onlySameGroup;

                        if (isCategoryDiscount) {
                            if (countWholeFamily) {
                                if (!categoryDiscountForFamily) {
                                    categoryDiscountForFamily = createBundleDiscount(oldPrices, category, allBundleDiscounts);
                                }
                            }
                            else if (!categoryDiscountForMember) {
                                categoryDiscountForMember = createBundleDiscount(oldPrices, category, allBundleDiscounts);
                            }
                        }
                    }

                    if (categoryDiscountForFamily && categoryDiscountForMember) {
                        break;
                    }
                }
            }

            // migrate prices for group
            for (const group of groups) {
                // sorted old prices
                const oldPricesArray = group.settings.oldPrices.slice().sort((a, b) => {
                    if (a.startDate === null) {
                        return -1;
                    }
                    if (b.startDate === null) {
                        return 1;
                    }
                    return a.startDate.getTime() - b.startDate.getTime();
                });

                if (oldPricesArray.length === 0) {
                    oldPricesArray.push(OldGroupPrices.create({
                        startDate: null,
                        prices: [],
                        sameMemberOnlyDiscount: false,
                        onlySameGroup: true,
                    }));
                }

                const prices: GroupPrice[] = [];

                // loop different tarriffs (with different start dates)
                for (let i = 0; i < oldPricesArray.length; i++) {
                    const oldPrices: OldGroupPrices = oldPricesArray[i];
                    const isCategoryDiscount = !oldPrices.onlySameGroup;
                    const next: OldGroupPrices | undefined = oldPricesArray[i + 1];

                    const firstPrice = oldPrices.prices[0] ?? OldGroupPrice.create({
                        price: 0,
                        reducedPrice: null,
                    });

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

                    const countWholeFamily = !oldPrices.sameMemberOnlyDiscount;

                    const discounts = createDiscounts(oldPrices);

                    if (categoryDiscountForFamily) {
                        // discount should be zero if discount is not a category discount (group discount) or if the discount is not for family members (but should be linked however)
                        const isZeroDiscount = !isCategoryDiscount || !countWholeFamily;

                        // set custom discounts if discounts are different
                        let customDiscounts: GroupPriceDiscount[] | undefined = discounts;

                        if (isZeroDiscount) {
                            customDiscounts = [GroupPriceDiscount.create({
                                type: GroupPriceDiscountType.Fixed,
                                value: ReduceablePrice.create({
                                    price: 0,
                                    reducedPrice: null,
                                }) })];
                        }
                        else if (areDiscountsEqual(categoryDiscountForFamily.discounts, discounts)) {
                            customDiscounts = undefined;
                        }

                        // add discount
                        groupPrice.bundleDiscounts.set(
                            categoryDiscountForFamily.id, BundleDiscountGroupPriceSettings.create({
                                name: categoryDiscountForFamily.name,
                                customDiscounts,
                            }));
                    }

                    if (categoryDiscountForMember) {
                        // discount should be zero if discount is not a category discount (group discount) or if the discount is for family members (but should be linked however)
                        const isZeroDiscount = !isCategoryDiscount || countWholeFamily;

                        // set custom discounts if discounts are different
                        let customDiscounts: GroupPriceDiscount[] | undefined = discounts;

                        if (isZeroDiscount) {
                            customDiscounts = [GroupPriceDiscount.create({
                                type: GroupPriceDiscountType.Fixed,
                                value: ReduceablePrice.create({
                                    price: 0,
                                    reducedPrice: null,
                                }) })];
                        }
                        else if (areDiscountsEqual(categoryDiscountForMember.discounts, discounts)) {
                            customDiscounts = undefined;
                        }

                        // add discount
                        groupPrice.bundleDiscounts.set(
                            categoryDiscountForMember.id, BundleDiscountGroupPriceSettings.create({
                                name: categoryDiscountForMember.name,
                                customDiscounts,
                            }));
                    }

                    // in other cases the bundle discount will have been added already (as a category discount)
                    if (oldPrices.prices.length > 1 && (oldPrices.onlySameGroup || isUnassigned)) {
                        const bundleDiscount = createBundleDiscount(oldPrices, category, allBundleDiscounts);
                        groupPrice.bundleDiscounts.set(bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
                            name: bundleDiscount.name,
                        }));
                    }

                    prices.push(groupPrice);
                }

                group.settings.prices = prices;
            }
        }

        // set bundle discounts on period and save
        if (allBundleDiscounts.length) {
            period.settings.bundleDiscounts = [...allBundleDiscounts];
            await period.save();
        }

        // save groups
        for (const group of allGroups) {
            await group.save();
        }
    }
}

function createCategoryMap(groups: Group[], archivedGroups: Group[], categories: GroupCategory[]) {
    // sort groups per category
    const categoryMap = new Map<string, Group[]>();
    const foundGroups = new Set<string>();

    for (const category of categories) {
        for (const groupId of category.groupIds) {
            const group = groups.find(g => g.id === groupId);
            if (group) {
                foundGroups.add(group.id);
                const otherGroups = categoryMap.get(category.id);
                if (otherGroups) {
                    otherGroups.push(group);
                }
                else {
                    categoryMap.set(category.id, [group]);
                }
            }
        }
    }

    const unassignedGroups = groups.filter(g => !foundGroups.has(g.id));
    // add archived groups to unassigned groups
    unassignedGroups.push(...archivedGroups);

    if (unassignedGroups.length) {
        categoryMap.set(UNNASSIGNED_KEY, unassignedGroups);
    }

    return categoryMap;
}

function createDiscounts(oldPrices: OldGroupPrices): GroupPriceDiscount[] {
    if (oldPrices.prices.length < 2) {
        return [GroupPriceDiscount.create({
            type: GroupPriceDiscountType.Fixed,
            value: ReduceablePrice.create({
                price: 0,
                reducedPrice: null,
            }) })];
    }

    const discounts: GroupPriceDiscount[] = [];
    const firstPrice = oldPrices.prices[0];
    const baseReducedPrice = firstPrice.reducedPrice === null ? firstPrice.price : firstPrice.reducedPrice;

    // skip first one
    for (let i = 1; i < oldPrices.prices.length; i++) {
        const oldGroupPrice = oldPrices.prices[i];

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

    return discounts;
}

function createBundleDiscount(oldPrices: OldGroupPrices, category: GroupCategory | undefined, allBundleDiscounts: BundleDiscount[]): BundleDiscount {
    if (!oldPrices.onlySameGroup && oldPrices.prices.length < 2) {
        throw new Error('Not enough prices');
    }

    const countWholeFamily = !oldPrices.sameMemberOnlyDiscount;
    const countPerGroup = oldPrices.onlySameGroup;

    const discounts = createDiscounts(oldPrices);

    const baseNameText = countWholeFamily ? 'Korting voor extra gezinslid' : 'Korting voor meerdere inschrijvingen';
    const nameText = oldPrices.onlySameGroup || !category ? baseNameText : `${category.settings.name} - ${baseNameText}`;

    const bundleDiscount = BundleDiscount.create({
        name: new TranslatedString(nameText),
        discounts,
        countWholeFamily,
        countPerGroup,
    });

    allBundleDiscounts.push(bundleDiscount);

    return bundleDiscount;
}

// copied from v1 code
function formatDate(date: Date) {
    const time = Formatter.time(date);
    if (time === '0:00') {
        return Formatter.date(date);
    }
    return Formatter.dateTime(date);
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
