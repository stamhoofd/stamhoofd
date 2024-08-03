import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleErrors } from "@simonbackx/simple-errors";
import { BalanceItemCartItem } from "./BalanceItemCartItem";
import { RegisterContext } from "./RegisterCheckout";
import { IDRegisterItem, RegisterItem } from "./RegisterItem";
import { Registration } from "../Registration";
import { RegistrationWithMember } from "../RegistrationWithMember";

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

    /**
     * You can define which registrations you want remove as part of this register operation.
     * This can be used to update registrations -> first delete them and add a new RegisterItem 
     * for them - internally the backend can handle this and maintain some data points from the
     * old registration
     */
    deleteRegistrations: RegistrationWithMember[] = []

    calculatePrices() {
        for (const item of this.items) {
            item.calculatePrice()
        }
    }

    clone() {
        const cart = new RegisterCart()
        cart.items = this.items.map(i => i.clone())
        cart.balanceItems = this.balanceItems.map(i => i.clone())
        return cart
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert()),
            balanceItems: this.balanceItems
        })
    }

    add(item: RegisterItem) {
        if (!this.canAdd(item)) {
            return;
        }
        this.items.push(item)
    }

    canAdd(item: RegisterItem) {
        if (this.contains(item)) {
            return false;
        }
        
        if (this.items.length >= 500) {
            return false;
        }

        if (this.paymentConfiguration && item.paymentConfiguration && item.paymentConfiguration !== this.paymentConfiguration) {
            return false;
        }
        return true;
    }

    contains(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id || (otherItem.member.id === item.member.id && otherItem.groupId === item.groupId)) {
                return true;
            }
        }
        return false;
    }

    getMemberAndGroup(memberId: string, groupId: string) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.member.id === memberId && otherItem.groupId === groupId) {
                return otherItem;
            }
        }
        return null;
    }

    containsMemberAndGroup(memberId: string, groupId: string) {
        return this.getMemberAndGroup(memberId, groupId) !== null;
    }

    remove(item: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id) {
                this.items.splice(i, 1);
                break;
            }
        }
    }

    removeMemberAndGroup(memberId: string, groupId: string) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const otherItem = this.items[i];
            
            if (otherItem.member.id === memberId && otherItem.groupId === groupId) {
                this.items.splice(i, 1);
            }
        }
    }

    removeRegistration(registration: RegistrationWithMember) {
        const index = this.deleteRegistrations.findIndex(r => r.id === registration.id)
        if (index === -1) {
            this.deleteRegistrations.push(registration)
        }
    }

    unremoveRegistration(registration: RegistrationWithMember) {
        const index = this.deleteRegistrations.findIndex(r => r.id === registration.id)
        if (index !== -1) {
            this.deleteRegistrations.splice(index, 1)
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

        return this.items[0].organization
    }

    validate() {
        const newItems: RegisterItem[] = []
        const errors = new SimpleErrors()
        for (const item of this.items) {
            try {
                item.validate()
                newItems.push(item)
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart')
                }
                errors.addError(e)

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item)
                }
            }
        }

        this.items = newItems
        errors.throwIfNotEmpty()
    }
}
