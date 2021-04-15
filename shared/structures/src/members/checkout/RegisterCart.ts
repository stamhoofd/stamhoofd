import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding"
import { SimpleErrors } from "@simonbackx/simple-errors"

import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from "../../Organization"
import { EncryptedMemberWithRegistrations } from "../EncryptedMemberWithRegistrations"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from "../MemberWithRegistrations"
import { RegisterCartPriceCalculator } from "./RegisterCartPriceCalculator"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IDRegisterItem, RegisterItem } from "./RegisterItem"
import { UnknownMemberWithRegistrations } from "./UnknownMemberWithRegistrations"

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

    get price(): number {
        return this.items.reduce((total, item) => {
            return total + item.calculatedPrice
        }, 0)
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

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]): void {
        const newItems: RegisterItem[] = []
        const errors = new SimpleErrors()

        for (const item of this.items) {
            try {
                item.validate(family, groups, categories, newItems)
                newItems.push(item)
            } catch (e) {
                errors.addError(e)
            }
        }

        this.items = newItems
        errors.throwIfNotEmpty()
    }

    calculatePrices(members: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]) {
        RegisterCartPriceCalculator.calculatePrices(this.items, members, groups, categories)
    }
}

/**
 * Contains all information about a given checkout
 */
export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    get price(): number {
        return this.items.reduce((total, item) => {
            return total + item.calculatedPrice
        }, 0)
    }

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

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]): void {
        const newItems: IDRegisterItem[] = []
        const errors = new SimpleErrors()

        for (const item of this.items) {
            try {
                item.validate(family, groups, categories, newItems)
                newItems.push(item)
            } catch (e) {
                errors.addError(e)
            }
        }

        this.items = newItems
        errors.throwIfNotEmpty()
    }

    calculatePrices(members: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[]) {
        RegisterCartPriceCalculator.calculatePrices(this.items, members, groups, categories)
    }
}