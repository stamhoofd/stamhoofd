import { AutoEncoder, field, ArrayDecoder } from "@simonbackx/simple-encoding";
import { OldRegisterCartPriceCalculator } from "./OldRegisterCartPriceCalculator";
import { RegisterContext } from "./RegisterCheckout";
import { IDRegisterItem, RegisterItem } from "./RegisterItem";
import { BalanceItemCartItem } from "./BalanceItemCartItem";

export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    @field({ decoder: new ArrayDecoder(BalanceItemCartItem), optional: true })
    balanceItems: BalanceItemCartItem[] = []

    hydrate(context: RegisterContext) {
        const cart = new RegisterCart()
        cart.items = this.items.map(i => i.hydrate(context))
        cart.balanceItems = this.balanceItems
        return cart
    }
}

export class RegisterCart {
    items: RegisterItem[] = []
    balanceItems: BalanceItemCartItem[] = []

    calculatePrices() {
        OldRegisterCartPriceCalculator.calculatePrices(
            this.items, 
            this.items.map(i => i.member.patchedMember), 
            this.items.map(i => i.group), 
            this.items.flatMap(i => i.organization.period.settings.categories) 
        )
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert()),
            balanceItems: this.balanceItems
        })
    }

    add(item: RegisterItem) {
        if (this.contains(item)) {
            return;
        }
        this.items.push(item)
    }

    canAdd(item: RegisterItem) {
        if (this.contains(item)) {
            return false;
        }
        if (this.paymentConfiguration && item.paymentConfiguration && item.paymentConfiguration !== this.paymentConfiguration) {
            return false;
        }
        return true;
    }

    contains(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id) {
                return true;
            }
        }
        return false;
    }

    remove(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id) {
                this.items.splice(i, 1);
                break;
            }
        }
    }

    get isEmpty() {
        return this.items.length === 0
    }

    get count() {
        return this.items.length
    }

    get price() {
        return this.items.reduce((total, item) => item.calculatedPrice + total, 0) 
            + this.balanceItems.reduce((total, item) => {
                return total + item.price
            }, 0)
    }

    get paymentConfiguration() {
        for (const item of this.items) {
            const organization = item.organization

            return organization.meta.registrationPaymentConfiguration
        }

        return null;
    }

    get singleOrganization() {
        if (this.items.length === 0) {
            return null;
        }

        const organization = this.items[0].organization
        for (const item of this.items) {
            if (item.organization.id !== organization.id) {
                return null;
            }
        }

        return organization
    }
}
