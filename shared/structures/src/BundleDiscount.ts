import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Group } from './Group.js';
import { GroupPriceDiscount } from './GroupPriceDiscount.js';
import { type RegisterCart } from './members/checkout/RegisterCart.js';
import { RegisterItem } from './members/checkout/RegisterItem.js';
import { type PlatformFamily, type PlatformMember } from './members/PlatformMember.js';
import { v4 as uuidv4 } from 'uuid';
import { TranslatedString } from './TranslatedString.js';
import { RegistrationWithPlatformMember } from './members/checkout/RegistrationWithPlatformMember.js';

export class BundleDiscount extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field(TranslatedString.field({}))
    name = new TranslatedString('');

    @field({ decoder: new ArrayDecoder(GroupPriceDiscount) })
    discounts: GroupPriceDiscount[] = []; // second, third, fourth...

    /**
     * Whether all registrations of the family are counted together (true), or they are all counted separately per member (false).
     */
    @field({ decoder: BooleanDecoder })
    countWholeFamily = false;

    /**
     * Whether all registrations are counted together regardless the group (false), or each group is counted separately (true).
     * Note: this is always false (ignored) if countWholeFamily is false. Because a member cannot register for the same group multiple times.
     */
    @field({ decoder: BooleanDecoder })
    countPerGroup = false;

    get humanDescription() {
        if (this.countWholeFamily) {
            if (this.countPerGroup) {
                return $t('43c1d02d-ca64-4809-95d6-50491c712cbb');
            }
            return $t('d098add1-c1b8-44d1-bf96-d762db3ea3cc');
        }

        return $t('200b5e3d-93d1-4c1c-80be-6eb0f2f75793');
    }

    static discountsToText(discounts: GroupPriceDiscount[]) {
        if (discounts.length === 0) {
            return $t('d3c259e4-4f8b-4f2f-9051-a943ef41dbd2');
        }
        return discounts.map((d, i) => {
            if (i === discounts.length - 1) {
                return $t('cb8ccc1d-7ec0-4c9d-bf02-6759109324ce', {
                    '5%': d.toString(),
                    '2': i + 2,
                });
            }
            return $t('4eda3d41-73fe-4063-8036-ccbd7290deaf', {
                '5%': d.toString(),
                '2': i + 2,
            });
        }).join(', ');
    }

    get discountsText() {
        return BundleDiscount.discountsToText(this.discounts);
    }

    calculate(cart: RegisterCart): BundleDiscountCalculationGroup {
        const group = new BundleDiscountCalculationGroup({
            bundle: this,
        });

        for (const item of cart.items) {
            const calculation = group.getCalculationFor(item);
            calculation?.add(item);

            for (const deletedRegistration of item.replaceRegistrations) {
                const cc = group.getCalculationFor(deletedRegistration);
                cc?.remove(deletedRegistration);
            }
        }

        for (const deletedRegistration of cart.deleteRegistrations) {
            const cc = group.getCalculationFor(deletedRegistration);
            cc?.remove(deletedRegistration);
        }

        // Loop all existing registrations that are not deleted - if they are already in a calculation group
        const loopedFamilies = new Set<PlatformFamily>();
        const loopedMembers = new Set<string>();

        for (const family of [
            ...cart.items.map(item => item.member.family),
            ...cart.deleteRegistrations.map(registration => registration.member.family),
        ]) {
            if (loopedFamilies.has(family)) {
                continue;
            }
            loopedFamilies.add(family);

            for (const member of family.members) {
                if (loopedMembers.has(member.id)) {
                    continue;
                }
                loopedMembers.add(member.id);

                for (const registration of member.filterRegistrations({})) {
                    const registrationWithPlatformMember = new RegistrationWithPlatformMember({
                        registration,
                        member,
                    });
                    const cc = group.getCalculationFor(registrationWithPlatformMember, {
                        // Only add it to the calculation if this registration is relevant for a new or removed registration that was added earlier
                        onlyExisting: true,
                    });
                    cc?.addIfNotBeingRemoved(registrationWithPlatformMember);
                }
            }
        }

        group.calculate();
        return group;
    }

    applyableTo(item: RegisterItem | RegistrationWithPlatformMember) {
        const groupPrice = item instanceof RegistrationWithPlatformMember ? item.registration.updatedGroupPrice : item.groupPrice;
        if (groupPrice.bundleDiscounts.has(this.id)) {
            return true;
        }
        if (item instanceof RegistrationWithPlatformMember) {
            if (item.registration.discounts.has(this.id)) {
                // This registration received the discount in the past, so it is still applyable
                return true;
            }
        }
        return false;
    }
}

class BundleDiscountCalculationGroup {
    bundle: BundleDiscount;

    calculations: Map<string, BundleDiscountCalculation> = new Map();

    constructor(options: {
        bundle: BundleDiscount;
    }) {
        this.bundle = options.bundle;
    }

    calculate() {
        for (const calculation of this.calculations.values()) {
            calculation.calculate();
        }
    }

    getCalculationFor(item: RegisterItem | RegistrationWithPlatformMember, options?: { onlyExisting?: boolean }) {
        if (!this.bundle.applyableTo(item)) {
            return null;
        }
        let groupingCode = 'family-' + item.member.family.uuid + '-';
        let group: Group | null = null;
        let member: PlatformMember | null = null;

        if (this.bundle.countWholeFamily) {
            if (this.bundle.countPerGroup) {
                groupingCode += item.group.id;
                group = item.group;
            }
            else {
                // Group by family objects (for admins)
            }
        }
        else {
            member = item.member;
            groupingCode += item.member.id;
        }
        const existing = this.calculations.get(groupingCode);
        if (!existing) {
            if (options?.onlyExisting) {
                return null;
            }

            const n = new BundleDiscountCalculation({
                bundle: this.bundle,
                group,
                member,
            });
            this.calculations.set(groupingCode, n);
            return n;
        }
        return existing;
    }
}

export class BundleDiscountCalculation {
    bundle: BundleDiscount;
    member: PlatformMember | null; // Only set when it is scoped to single members, not a family
    group: Group | null; // Only set when scoped to a single group, not multiple groups

    /**
     *  Keep track of the distribution of discounts.
     *  This will set the 'applied discounts' for these items once their registration is created in the database
     */
    items: Map<RegisterItem, number>;

    /**
     *  Existing registations that cause a discount.
     *  The value contains the new calculated discount for this registration
     */
    registrations: Map<RegistrationWithPlatformMember, number>;

    /**
     * Keeps track of the deleted registrations so we can exclude these registrations from the calculation
    */
    deleteRegistrations: RegistrationWithPlatformMember[];

    constructor(options: {
        bundle: BundleDiscount;
        group?: Group | null;
        member?: PlatformMember | null;
    }) {
        this.bundle = options.bundle;
        this.group = options.group ?? null;
        this.member = options.member ?? null;

        this.items = new Map();
        this.registrations = new Map();
        this.deleteRegistrations = [];
    }

    get name() {
        const suffix: string[] = [];

        if (this.group) {
            suffix.push(this.group.settings.name.toString());
        }

        if (this.member) {
            suffix.push(this.member.patchedMember.firstName);
        }
        return this.bundle.name + (suffix.length > 0 ? ' (' + suffix.join(', ') + ')' : '');
    }

    /**
        The total dicount, not taking into account what has already been given in the past
    */
    get total() {
        return [...this.items.values()].reduce((a, b) => a + b, 0)
            + [...this.registrations.values()].reduce((a, b) => a + b, 0);
    }

    get totalAlreadyApplied() {
        let c = 0;
        for (const registration of this.registrations.keys()) {
            c += registration.registration.discounts.get(this.bundle.id)?.amount ?? 0;
        }

        // Note: do not subtract the discounts on the deleted registrations
        // These registrations will be deleted anyway, so their balance will be cancelled, that balance includes their discounts
        // the bundle discounts only reflect the situation without all the deleted registrations
        return c;
    }

    get netTotal() {
        return this.total - this.totalAlreadyApplied;
    }

    get netTotalDueLater() {
        let sum = 0;
        for (const [item, value] of this.items) {
            if (item.calculatedTrialUntil) {
                // Due later
                sum += value;
            }
        }
        return sum;
    }

    get netTotalDueNow() {
        return this.netTotal - this.netTotalDueLater;
    }

    getTotalFor(item: RegisterItem | RegistrationWithPlatformMember) {
        if (item instanceof RegisterItem) {
            return this.items.get(item) ?? 0;
        }
        else if (item instanceof RegistrationWithPlatformMember) {
            return (this.registrations.get(item) ?? 0);
        }
        return 0;
    }

    addIfNotBeingRemoved(item: RegisterItem | RegistrationWithPlatformMember) {
        // Only add if it is not being removed at the same time
        if (item instanceof RegistrationWithPlatformMember) {
            if (this.deleteRegistrations.find(r => r.registration.id === item.registration.id)) {
                return;
            }
        }

        this.add(item);
    }

    add(item: RegisterItem | RegistrationWithPlatformMember) {
        if (item instanceof RegistrationWithPlatformMember) {
            this.registrations.set(item, 0);
        }
        else if (item instanceof RegisterItem) {
            this.items.set(item, 0);
        }
    }

    remove(registration: RegistrationWithPlatformMember) {
        this.deleteRegistrations.push(registration);
    }

    get itemsAndRegistrations() {
        // We reverse the order of the items so that the discount is applied by preference on the last added items in the cart
        // that way, the discount is proplery visible while adding items (unless there are price differences)
        // First items in the array = will get the discounts first if they are the same
        return [...[...this.items.keys()].reverse(), ...this.registrations.keys()];
    }

    calculate() {
        // For each item and registration, calculate the price matrix
        // Price if used as first item, second item, third item
        // We'll then calculate the optimal order using the Hungarian Algorithm
        const arr = this.itemsAndRegistrations;
        const priceMatrix: number[][] = [];

        for (const item of arr) {
            // We always use the group price here, because this is safer, also for registrations (in case we have deactivated registrations with cancallation fees)
            const price = item instanceof RegisterItem ? (item.groupPrice.price.forMember(item.member)) : item.registration.groupPrice.price.forMember(item.member);
            const discounts = item instanceof RegisterItem
                ? (item.groupPrice.bundleDiscounts.get(this.bundle.id)?.customDiscounts ?? this.bundle.discounts)
                : (item.registration.groupPrice.bundleDiscounts.get(this.bundle.id)?.customDiscounts ?? this.bundle.discounts);

            const row: number[] = [];

            for (const [index] of arr.entries()) {
                if (index === 0) {
                    row.push(0);
                    continue;
                }

                const discount = discounts[index - 1] ?? discounts[discounts.length - 1]; // Repeat last
                const calculated = discount.calculateDiscount(price, item.member);
                row.push(calculated);
            }

            priceMatrix.push(row);
        }

        const solved = hungarian(priceMatrix);

        for (const [index, item] of arr.entries()) {
            const nth = solved[index];
            const discount = priceMatrix[index][nth];

            if (item instanceof RegistrationWithPlatformMember) {
                this.registrations.set(item, discount);
            }
            else {
                this.items.set(item, discount);
            }
        }
    }
}
/**
 * Optimized algorithm to maximize the total discount
 * Returns an array where each index corresponds to the nth discount for each item
 * @param priceMatrix A 2D array where priceMatrix[i][j] represents the discount amount for the ith item at the jth position
 */
function hungarian(priceMatrix: number[][]): number[] {
    // No items to process
    if (priceMatrix.length === 0) {
        return [];
    }

    const n = priceMatrix.length;
    const assignment: number[] = new Array(n).fill(0);

    // Pre-calculate max discounts for each item to avoid repeated calculations
    const itemMaxDiscounts: { index: number; maxDiscount: number }[] = [];
    for (let i = 0; i < n; i++) {
        // Find max discount (skip position 0)
        let maxDiscount = 0;
        for (let j = 1; j < priceMatrix[i].length; j++) {
            maxDiscount = Math.max(maxDiscount, priceMatrix[i][j]);
        }
        itemMaxDiscounts.push({ index: i, maxDiscount });
    }

    // Sort indices by their maximum potential discount (descending)
    itemMaxDiscounts.sort((a, b) => b.maxDiscount - a.maxDiscount);

    // Track assigned positions
    const assigned = new Set<number>();

    // For each item (in order of maximum discount potential)
    for (const { index: i } of itemMaxDiscounts) {
        let bestPos = 0;
        let bestDiscount = priceMatrix[i][0];

        // Find the best unassigned position for this item
        for (let j = 1; j < priceMatrix[i].length; j++) {
            if (!assigned.has(j) && priceMatrix[i][j] > bestDiscount) {
                bestPos = j;
                bestDiscount = priceMatrix[i][j];
            }
        }

        assignment[i] = bestPos;
        if (bestPos !== 0) {
            assigned.add(bestPos);
        }
    }

    return assignment;
}
