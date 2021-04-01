import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding"
import { SimpleErrors } from "@simonbackx/simple-errors"

import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
import { GroupPrices } from "../../GroupPrices"
// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from "../../Organization"
import { EncryptedMemberWithRegistrations } from "../EncryptedMemberWithRegistrations"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from "../MemberWithRegistrations"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IDRegisterItem, IDRegisterItemCalculated, RegisterItem } from "./RegisterItem"


/**
 * Contains all information about a given checkout
 */
export class RegisterCart {
    items: RegisterItem[] = []

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert())
        })
    }

    /**
     * todo
     */
    get price(): number {
        return 0
    }

    get count(): number {
        return this.items.length
    }

    hasItem(item: RegisterItem): boolean {
        const c = item.id
        for (const i of this.items) {
            if (i.id === c) {
                return true
            }
        }
        return false
    }

    addItem(item: RegisterItem): void {
        const c = item.id
        for (const [index, i,] of this.items.entries()) {
            if (i.id === c) {

                // replace
                this.items.splice(index, 1)
                break;
            }
        }
        this.items.push(item)
    }

    removeItem(item: RegisterItem): void {
        const c = item.id
        for (const [index, i] of this.items.entries()) {
            if (i.id === c) {
                this.items.splice(index, 1)
                return
            }
        }
    }

    validate(family: MemberWithRegistrations[], all: GroupCategory[]): void {
        const newItems: RegisterItem[] = []
        const errors = new SimpleErrors()

        for (const item of this.items) {
            try {
                item.validate(family, all)
                newItems.push(item)
            } catch (e) {
                errors.addError(e)
            }
        }

        this.items = newItems
        errors.throwIfNotEmpty()
    }
}

/**
 * Contains all information about a given checkout
 */
export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    convert(organization: Organization, members: MemberWithRegistrations[]): RegisterCart {
        const cart = new RegisterCart()
        cart.items = this.items.flatMap((item) => {
            const converted = item.convert(organization, members)
            if (converted !== null) {
                return [converted]
            }
            return []
        })

        return cart
    }

    calculatePrices(members: EncryptedMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]): IDRegisterCartCalculated {
        if (this.items.length > 15) {
            // Secure maximum
            throw new Error("Maximum 15 registrations allowed at the same time")
        }

        const now = new Date()

        // Step 1: add all information to the items
        const newItems: IDRegisterItemCalculated[] = this.items.map(item => {
            const group = groups.find(g => g.id === item.groupId)
            const member = members.find(m => m.id === item.memberId)

            if (!group || !member) {
                throw new Error("Invalid item: member or group doesn't exist anymore")
            }
            let groupPrices: GroupPrices | undefined
            if (!item.waitingList) {
                groupPrices = group.settings.getGroupPrices(now)
                if (!groupPrices) {
                    throw new Error("We konden geen passende prijs vinden voor deze inschrijving. Contacteer ons zodat we dit probleem kunnen recht zetten")
                }
            }

            return IDRegisterItemCalculated.create({
                ...item,
                group,
                member,
                groupPrices
            })
        })

        // Step 2: group items by items that have a grouped family discount
        // Excluding waiting lists
        const groupedItems = new Map<string, IDRegisterItemCalculated[]>()
        const calculatedItems: IDRegisterItemCalculated[] = []

        for (const item of newItems) {
            if (item.waitingList) {
                // Price is always zero
                calculatedItems.push(item)
                continue
            }
            const id = item.getFamilyDiscountId(categories)
            const arr = groupedItems.get(id)
            if (arr) {
                arr.push(item)
            } else {
                groupedItems.set(id, [item])
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
                        if (registration.getFamilyDiscountId(groups, categories) == familyID) {
                            existingCount++
                        }
                    }
                }
            }

            // Order in all possible ways (where only the first X places matter)
            const combinations = getPossibleCombinations(items, 2 - existingCount)

            let minimumPrice: number | null = null
            let minimumCombination: IDRegisterItemCalculated[] = []

            // Calculate the smallest price
            for (const combination of combinations) {
                let total = 0
                let alreadyRegisteredCount = existingCount
                for (const item of combination) {
                    const price = item.groupPrices.getPriceFor(item.reduced, alreadyRegisteredCount)
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
                const price = item.groupPrices.getPriceFor(item.reduced, alreadyRegisteredCount)
                item.calculatedPrice = price
                alreadyRegisteredCount++

                // Add to the calculated cart
                calculatedItems.push(item)
            }
        }

        return IDRegisterCartCalculated.create({
            items: calculatedItems
        })
    }
}

/**
 * Contains all information about a given checkout
 */
export class IDRegisterCartCalculated extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItemCalculated) })
    items: IDRegisterItemCalculated[] = []

}

/**
 * Return all the possible ordering of the first x items (= amount) of a given array.
 * E.g. [1, 2, 3, 4, 5] for 2 items: [1, 2, (3, 4, 5)], [1, 3, (2, 4, 5)], [1, 4, (2, 3, 5)], [1, 5, (3, 4, 2)], [2, 1, (3, 4, 5)], ...
 */
function getPossibleCombinations<T>(array: T[], amount: number): T[][] {
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