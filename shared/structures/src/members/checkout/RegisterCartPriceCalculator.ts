import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
import { GroupPrices } from "../../GroupPrices"
import { UnknownMemberWithRegistrations } from "./UnknownMemberWithRegistrations"

/**
 * Represents both RegisterItem's
 */
interface RegisterItemWithPrice {
    memberId: string
    groupId: string
    reduced: boolean
    waitingList: boolean

    // Prices
    calculatedPrice: number
}

interface RegisterItemWithPriceAndGroupPrices extends RegisterItemWithPrice {
    /// Cached to improve calculation performance
    _groupPrices: GroupPrices
}

export class RegisterCartPriceCalculator {
    /**
     * Return an unique ID that is the same for all groups that should have equal family pricing (2nd, 3rd discount)
     */
    private static getFamilyDiscountIdFor(group: Group, all: GroupCategory[]) {
        const parents = group.getParentCategories(all, false)
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations === 1) {
                return "category-"+parent.id
            }
        }

        // Only registrations in same group are elegiable for family discount
        return "group-"+group.id
    }

    /**
     * @param items Items you want to calculate the prices for (should be all the items)
     * @param members All current members, including members that are not present in the items (because we need to know this for family discounts)
     * @param groups All the groups of this organization
     * @param categories All the categories of this organization
     */
    static calculatePrices(items: RegisterItemWithPrice[], members: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]) {
        // Step 1 + 2: 
        // 1. add the group prices
        // 2. group items by items that have a grouped family discount
        // Excluding waiting lists
        const groupedItems = new Map<string, RegisterItemWithPriceAndGroupPrices[]>()

        const now = new Date()
        for (const item of items) {
            item.calculatedPrice = 0

            const group = groups.find(g => g.id === item.groupId)
            const member = members.find(m => m.id === item.memberId)

            if (!group || !member) {
                throw new Error("Invalid item: member or group doesn't exist anymore")
            }

            if (!item.waitingList) {
                const groupPrices = group.settings.getGroupPrices(now)
                if (!groupPrices) {
                    throw new Error("We konden geen passende prijs vinden voor deze inschrijving. Contacteer ons zodat we dit probleem kunnen recht zetten")
                }
                const _item = Object.assign(item, { _groupPrices: groupPrices })

                // Add to the group
                const id = this.getFamilyDiscountIdFor(group, categories)
                const arr = groupedItems.get(id)
                if (arr) {
                    arr.push(_item)
                } else {
                    groupedItems.set(id, [_item])
                }
            }
        }

        // Step 3: calculate all possible prices
        for (const [familyID, items] of groupedItems) {
            // Count all members that are already registered in this family discount group
            // (to know the number of members, and to know the discount)
            let existingCount = 0
            for (const member of members) {
                for (const registration of member.registrations) {
                    const group = groups.find(g => g.id === registration.groupId)
                    if (group && !registration.waitingList && registration.cycle === group.cycle && registration.registeredAt !== null && registration.deactivatedAt === null) {
                        // Active registration
                        if (this.getFamilyDiscountIdFor(group, categories) == familyID) {
                            existingCount++
                        }
                    }
                }
            }

            // Order in all possible ways (where only the first X places matter)
            const combinations = getPossibleCombinations(items, 2 - existingCount)

            let minimumPrice: number | null = null
            let minimumCombination: RegisterItemWithPriceAndGroupPrices[] = []

            // Calculate the smallest price
            for (const combination of combinations) {
                let total = 0
                let alreadyRegisteredCount = existingCount
                for (const item of combination) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const price = item._groupPrices.getPriceFor(item.reduced, alreadyRegisteredCount)
                    alreadyRegisteredCount++
                    total += price
                }

                if (minimumPrice === null || total < minimumPrice) {
                    minimumPrice = total
                    minimumCombination = combination
                }
            }

            // Calculate once again to set the fixed price for every item
            let alreadyRegisteredCount = existingCount
            for (const item of minimumCombination) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const price = item._groupPrices.getPriceFor(item.reduced, alreadyRegisteredCount)
                item.calculatedPrice = price
                alreadyRegisteredCount++
            }
        }

        // Clean up
        for (const item of items) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const i = (item as any)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete i._groupPrices;
        }
    }
}

/**
 * Return all the possible ordering of the first x items (= amount) of a given array.
 * E.g. [1, 2, 3, 4, 5] for 2 items: [1, 2, (3, 4, 5)], [1, 3, (2, 4, 5)], [1, 4, (2, 3, 5)], [1, 5, (3, 4, 2)], [2, 1, (3, 4, 5)], ...
 */
export function getPossibleCombinations<T>(array: T[], amount: number): T[][] {
    if (amount <= 0) {
        // Only one possibility
        return [array]
    }

    if (array.length <= 1) {
        // Only one possible combination
        return [array]
    }

    // On array.length possibilities
    return array.flatMap((first, index) => {
        // Remove first from the array, get possible combinations, append first back to each combination and return these combinations
        const arr = array.slice()
        arr.splice(index, 1)

        // Get all possibilities
        const combo = getPossibleCombinations(arr, amount - 1)

        // Append first back to all possible combinations
        for (const c of combo) {
            c.unshift(first)
        }

        return combo
    })
}