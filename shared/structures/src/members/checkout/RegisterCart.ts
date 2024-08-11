import { ArrayDecoder, AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { BalanceItemWithPayments } from "../../BalanceItem";
import { RegistrationWithMember } from "../RegistrationWithMember";
import { BalanceItemCartItem } from "./BalanceItemCartItem";
import { RegisterContext } from "./RegisterCheckout";
import { IDRegisterItem, RegisterItem } from "./RegisterItem";

export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    @field({ decoder: new ArrayDecoder(BalanceItemCartItem), optional: true })
    balanceItems: BalanceItemCartItem[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    deleteRegistrationIds: string[] = []

    hydrate(context: RegisterContext) {
        const cart = new RegisterCart()
        cart.items = this.items.map(i => i.hydrate(context))
        cart.balanceItems = this.balanceItems

        const registrations: RegistrationWithMember[] = []
        for (const registrationId of this.deleteRegistrationIds) {
            let found = false;
            for (const member of context.members) {
                const registration = member.patchedMember.registrations.find(r => r.id === registrationId)
                if (!registration) {
                    continue;
                }
                
                registrations.push(RegistrationWithMember.from(registration, member.patchedMember.tiny))
                found = true;
                break;
            }

            if (!found) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Registration not found',
                    human: 'De inschrijving die je wou verwijderen kon niet gevonden worden. Het is mogelijk dat deze inschrijving al verwijderd is.',
                    field: 'deleteRegistrationIds'
                })
            }

        }
        cart.deleteRegistrations = registrations

        return cart
    }
}

export class RegisterCart {
    items: RegisterItem[] = []
    balanceItems: BalanceItemCartItem[] = []

    /**
     * You can define which registrations you want remove as part of this register operation.
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
        cart.deleteRegistrations = this.deleteRegistrations.map(r => r.clone())
        return cart
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert()),
            balanceItems: this.balanceItems,
            deleteRegistrationIds: this.deleteRegistrations.map(r => r.id)
        })
    }

    add(item: RegisterItem) {
        if (this.contains(item)) {
            return this.remove(item, item)
        }

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

        if (this.singleOrganization && item.organization.id !== this.singleOrganization.id) {
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

    remove(item: RegisterItem, replaceWith?: RegisterItem) {
        for (const [i, otherItem] of this.items.entries()) {
            if (otherItem.id === item.id || (otherItem.member.id === item.member.id && otherItem.groupId === item.groupId)) {
                this.items.splice(i, 1, ...(replaceWith ? [replaceWith] : []));
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
        return this.count === 0
    }

    get count() {
        return this.items.length + this.balanceItems.length + this.deleteRegistrations.length
    }

    get price() {
        return this.items.reduce((total, item) => item.calculatedPrice + total, 0) 
            + this.balanceItems.reduce((total, item) => {
                return total + item.price
            }, 0)
    }

    get refund() {
        return this.items.reduce((total, item) => item.calculatedRefund + total, 0) 
            + this.deleteRegistrations.reduce((total, item) => {
                return total + item.price
            }, 0)
    }

    get singleOrganization() {
        if (this.items.length === 0) {
            return null;
        }

        return this.items[0].organization
    }

    validate(data?: {memberBalanceItems?: BalanceItemWithPayments[]}) {
        const newItems: RegisterItem[] = []
        const errors = new SimpleErrors()
        for (const item of this.items) {
            try {
                item.validate()
                item.cartError = null;
                newItems.push(item)
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart')
                    errors.addError(e)
                } else {
                    throw e
                }

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item)
                }
            }
        }

        const cleanedBalanceItems: BalanceItemCartItem[] = []
        for (const balanceItem of this.balanceItems) {
            // TODO: validate balance item organization (happens in backend anyway)

            try {
                balanceItem.validate({balanceItems: data?.memberBalanceItems})
                cleanedBalanceItems.push(balanceItem)
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart')
                    errors.addError(e)
                } else {
                    throw e
                }
            }
        }

        const cleanedRegistrations: RegistrationWithMember[] = []
        for (const registration of this.deleteRegistrations) {
            if (this.singleOrganization && registration.group.organizationId !== this.singleOrganization?.id) {
                errors.addError(new SimpleError({
                    code: 'invalid_organization',
                    message: 'Invalid organization in deleteRegistrations',
                    human: 'Het is niet mogelijk om een inschrijving te verwijderen samen met een inschrijving voor een andere organisatie, dit moet apart gebeuren.',
                    field: 'deleteRegistrations'
                }))
                continue;
            }
            cleanedRegistrations.push(registration)
        }

        this.balanceItems = cleanedBalanceItems
        this.deleteRegistrations = cleanedRegistrations
        this.items = newItems
        errors.throwIfNotEmpty()
    }
}
