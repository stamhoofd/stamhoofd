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

    _group: Group
    _category: GroupCategory
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
     * Return an unique ID that is the same for all groups that should have equal family pricing (2nd, 3rd discount)
     */
    private static getParentCategory(group: Group, all: GroupCategory[]): GroupCategory | null {
        const parents = group.getParentCategories(all, false)
        return parents[0] ?? null
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
        //      - First: no discounts or only discount for same group (ordering doesn't matter)
        //      - Second: Discounts for same member in category
        //      - Last: Diuscounts for family members in category
        // Excluding waiting lists
        const groupedItems: [RegisterItemWithPriceAndGroupPrices[], Map<string, RegisterItemWithPriceAndGroupPrices[]>, Map<string, RegisterItemWithPriceAndGroupPrices[]>]
             = [[], new Map<string, RegisterItemWithPriceAndGroupPrices[]>(), new Map<string, RegisterItemWithPriceAndGroupPrices[]>()]

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

                const category = this.getParentCategory(group, categories)

                if (!category) {
                    throw new Error("Invalid item: category doesn't exist anymore")
                }

                const _item = Object.assign(item, { _groupPrices: groupPrices, _group: group, _category: category })

                // In which priority queue?
                if (groupPrices.onlySameGroup || groupPrices.prices.length <= 1) {
                    // First queue: ordering will never matter
                    groupedItems[0].push(_item)
                } else {
                    const prior: 1 | 2 = groupPrices.sameMemberOnlyDiscount ? 1 : 2
                    const key = groupPrices.sameMemberOnlyDiscount ? (category.id+"-"+member.id) : category.id
                    const arr = groupedItems[prior].get(key) ?? []
                    arr.push(_item)
                    groupedItems[prior].set(key, arr)
                }
            }
        }

        // Keep a mapping of amount of members that is registered in each category +  each group

        /// Group ID => amount of members that are registered
        const groupAmounts = new Map<string, number>()
        // Amount of registrations in a given group for a given member (member id is first)
        const groupPerMemberAmounts = new Map<string, Map<string, number>>()

        /// Category ID => amount of members that are registered
        const categoryAmounts = new Map<string, number>()
        // Amount of registrations in a given category for a given member (member id is first)
        const categoryPerMemberAmounts = new Map<string, Map<string, number>>()

        // Fill in the existing registrations
        for (const member of members) {
            // Create map items
            const groupAmountsMember = new Map<string, number>()
            const categoryAmountsMember = new Map<string, number>()
            groupPerMemberAmounts.set(member.id, groupAmountsMember)
            categoryPerMemberAmounts.set(member.id, categoryAmountsMember)

            for (const registration of member.registrations) {
                // Skip this if we have an item in the cart with the same properties
                const inCart = !!items.find(i => i.memberId === member.id && i.groupId === registration.groupId)
                if (inCart) {
                    continue
                }
                const group = groups.find(g => g.id === registration.groupId)
                if (group && !registration.waitingList && registration.cycle === group.cycle && registration.registeredAt !== null && registration.deactivatedAt === null) {
                    // Active registration
                    groupAmounts.set(group.id, (groupAmounts.get(group.id) ?? 0) + 1)
                    groupAmountsMember.set(group.id, (groupAmountsMember.get(group.id) ?? 0) + 1)

                    const category = this.getParentCategory(group, categories)
                    if (category) {
                        categoryAmounts.set(category.id, (categoryAmounts.get(category.id) ?? 0) + 1)
                        categoryAmountsMember.set(category.id, (categoryAmountsMember.get(category.id) ?? 0) + 1)
                    }
                }
            }
        }

        // All items that are not affected by ordering calculate first
        for (const item of groupedItems[0]) {
            // Todo: cache this information
            const group = item._group
            const category = item._category

            let alreadyRegisteredCount = 0

            if (item._groupPrices.prices.length > 1) {
                if (item._groupPrices.onlySameGroup) {
                    if (item._groupPrices.sameMemberOnlyDiscount) {
                        alreadyRegisteredCount = groupPerMemberAmounts.get(item.memberId)?.get(item.groupId) ?? 0
                    } else {
                        alreadyRegisteredCount = groupAmounts.get(item.groupId) ?? 0
                    }
                } else {
                    throw new Error("Category based discount shouldn't be in priority 0 queue")
                    if (item._groupPrices.sameMemberOnlyDiscount) {
                        alreadyRegisteredCount = categoryPerMemberAmounts.get(item.memberId)?.get(category.id) ?? 0
                    } else {
                        alreadyRegisteredCount = categoryAmounts.get(category.id) ?? 0
                    }
                }
            }
            
            const price = item._groupPrices.getPriceFor(item.reduced, alreadyRegisteredCount)
            item.calculatedPrice = price

            // Increase counters
            const groupAmountsMember = groupPerMemberAmounts.get(item.memberId)!
            const categoryAmountsMember = categoryPerMemberAmounts.get(item.memberId)!

            groupAmounts.set(group.id, (groupAmounts.get(group.id) ?? 0) + 1)
            groupAmountsMember.set(group.id, (groupAmountsMember.get(group.id) ?? 0) + 1)
            categoryAmounts.set(category.id, (categoryAmounts.get(category.id) ?? 0) + 1)
            categoryAmountsMember.set(category.id, (categoryAmountsMember.get(category.id) ?? 0) + 1)
        }

        // Discount for category, for same member
        for (const [_, items] of groupedItems[1]) {

            const memberId = items[0].memberId
            const group = items[0]._group
            const category = items[0]._category
            const maxFamilyMembersDiscount = Math.max(...items.map(i => i._groupPrices.prices.length))

            // Get current amounts
            const existingCount = categoryPerMemberAmounts.get(memberId)?.get(category.id) ?? 0

            // Find most optimal order
            const combinations = getPossibleCombinations(items, maxFamilyMembersDiscount - 1 - existingCount)

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

                // Increase counters for next cycle (groups don't matter anymore, so skipped, and same member also doesn't matter anymore)
                //const groupAmountsMember = groupPerMemberAmounts.get(item.memberId)!
                //const categoryAmountsMember = categoryPerMemberAmounts.get(item.memberId)!

                //groupAmounts.set(group.id, (groupAmounts.get(group.id) ?? 0) + 1)
                //groupAmountsMember.set(group.id, (groupAmountsMember.get(group.id) ?? 0) + 1)
                categoryAmounts.set(category.id, (categoryAmounts.get(category.id) ?? 0) + 1)
                //categoryAmountsMember.set(category.id, (categoryAmountsMember.get(category.id) ?? 0) + 1)
            }
        }

        // Discount for category, for same member
        for (const [_, items] of groupedItems[2]) {

            const memberId = items[0].memberId
            const group = items[0]._group
            const category = items[0]._category
            const maxFamilyMembersDiscount = Math.max(...items.map(i => i._groupPrices.prices.length))

            // Get current amounts
            const existingCount = categoryAmounts.get(category.id) ?? 0

            // Find most optimal order
            const combinations = getPossibleCombinations(items, maxFamilyMembersDiscount - 1 - existingCount)

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

                // No need to increase counters: it's done
            }
        }

        // Step 3: calculate all possible prices
        /*for (const [familyID, items] of groupedItems) {
            // Count all members that are already registered in this family discount group
            // (to know the number of members, and to know the discount)
            let existingCount = 0
            for (const member of members) {
                for (const registration of member.registrations) {

                    // Skip this if we have an item in the cart with the same properties
                    const inCart = !!items.find(i => i.memberId === member.id && i.groupId === registration.groupId)
                    if (inCart) {
                        continue
                    }
                    const group = groups.find(g => g.id === registration.groupId)
                    if (group && !registration.waitingList && registration.cycle === group.cycle && registration.registeredAt !== null && registration.deactivatedAt === null) {
                        // Active registration
                        if (this.getFamilyDiscountIdFor(group, categories) == familyID) {
                            existingCount++
                        }
                    }
                }
            }

            // todo: move those without discounts to the start and remove them from the combinations that need to get calculated. They always need to be added first because they don't give discount
 
            const maxFamilyMembersDiscount = 3 // discount for third + more members

            // Order in all possible ways (where only the first X places matter)
            const combinations = getPossibleCombinations(items, maxFamilyMembersDiscount - 1 - existingCount)

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
        }*/

        // Clean up
        for (const item of items) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const i = (item as any)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete i._groupPrices;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete i._group;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete i._category;
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