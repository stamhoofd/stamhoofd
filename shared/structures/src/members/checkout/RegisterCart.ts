import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from "@simonbackx/simple-encoding"
import { SimpleErrors } from "@simonbackx/simple-errors"

import { MemberBalanceItem } from "../../BalanceItemDetailed"
import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from "../../Organization"
import { PaymentConfiguration } from "../../PaymentConfiguration"
import { EncryptedMemberWithRegistrations } from "../EncryptedMemberWithRegistrations"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from "../MemberWithRegistrations"
import { RegisterCartPriceCalculator } from "./RegisterCartPriceCalculator"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BalanceItemCartItem, IDRegisterItem, RegisterItem } from "./RegisterItem"
import { UnknownMemberWithRegistrations } from "./UnknownMemberWithRegistrations"

/**
 * Contains all information about a given checkout
 */
export class RegisterCart {
    items: RegisterItem[] = []
    balanceItems: BalanceItemCartItem[] = []
    freeContribution = 0
    administrationFee = 0

    constructor(items: RegisterItem[] = []) {
        this.items = items
    }

    clear() {
        this.items = []
        this.balanceItems = []
        this.freeContribution = 0
        this.administrationFee = 0
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert()),
            balanceItems: this.balanceItems,
            freeContribution: this.freeContribution,
            administrationFee: this.administrationFee
        })
    }

    get priceWithoutFees(): number {
        return this.items.reduce((total, item) => {
            return total + item.calculatedPrice
        }, 0) + this.balanceItems.reduce((total, item) => {
            return total + item.price
        }, 0) 
    }

    get price(): number {
        return this.priceWithoutFees 
            + this.freeContribution 
            + this.administrationFee;
    }

    get count(): number {
        return this.items.length + this.balanceItems.length
    }

    get isEmpty(): boolean {
        return this.count === 0
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
        this.removeItem(item)
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

    addBalanceItem(item: BalanceItemCartItem): void {
        this.removeBalanceItem(item)
        this.balanceItems.push(item)
    }

    removeBalanceItem(item: BalanceItemCartItem): void {
        const c = item.item.id
        for (const [index, i] of this.balanceItems.entries()) {
            if (i.item.id === c) {
                this.balanceItems.splice(index, 1)
                return
            }
        }
    }

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], memberBalanceItems: MemberBalanceItem[]): void {
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

        const newBalanceItems: BalanceItemCartItem[] = []
        for (const item of this.balanceItems) {
            try {
                item.validate(memberBalanceItems)
                newBalanceItems.push(item)
            } catch (e) {
                errors.addError(e)
            }
        }
        this.balanceItems = newBalanceItems
        
        errors.throwIfNotEmpty()
    }

    calculatePrices(members: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], paymentConfiguration: PaymentConfiguration) {
        RegisterCartPriceCalculator.calculatePrices(
            this.items, 
            members, 
            groups, 
            categories
        )
        this.administrationFee = paymentConfiguration.administrationFee.calculate(this.priceWithoutFees)
    }
}

/**
 * Contains all information about a given checkout
 */
export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    @field({ decoder: new ArrayDecoder(BalanceItemCartItem), optional: true })
    balanceItems: BalanceItemCartItem[] = []

    @field({ decoder: IntegerDecoder, version: 91 })
    freeContribution = 0

    @field({ decoder: IntegerDecoder, version: 208 })
    administrationFee = 0;

    get priceWithoutFees(): number {
        return this.items.reduce((total, item) => {
            return total + item.calculatedPrice
        }, 0) + this.balanceItems.reduce((total, item) => {
            return total + item.price
        }, 0) 
    }

    get price(): number {
        return this.priceWithoutFees 
            + this.freeContribution 
            + this.administrationFee;
    }
    
    get count(): number {
        return this.items.length + this.balanceItems.length
    }

    get isEmpty(): boolean {
        return this.count === 0
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
        cart.balanceItems = this.balanceItems
        cart.freeContribution = this.freeContribution
        cart.administrationFee = this.administrationFee

        return cart
    }

    validate(family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], memberBalanceItems: MemberBalanceItem[]): void {
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

        const newBalanceItems: BalanceItemCartItem[] = []
        for (const item of this.balanceItems) {
            try {
                item.validate(memberBalanceItems)
                newBalanceItems.push(item)
            } catch (e) {
                errors.addError(e)
            }
        }
        this.balanceItems = newBalanceItems

        errors.throwIfNotEmpty()
    }

    calculatePrices(members: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], paymentConfiguration: PaymentConfiguration, forceDate?: Date) {
        RegisterCartPriceCalculator.calculatePrices(this.items, members, groups, categories, forceDate)
        this.administrationFee = paymentConfiguration.administrationFee.calculate(this.priceWithoutFees)
    }
}