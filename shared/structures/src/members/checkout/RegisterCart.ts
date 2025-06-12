import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { BalanceItem } from '../../BalanceItem.js';
import { type BundleDiscount, type BundleDiscountCalculation } from '../../BundleDiscount.js';
import { Platform } from '../../Platform.js';
import { BalanceItemCartItem } from './BalanceItemCartItem.js';
import { type RegisterCheckout, type RegisterContext } from './RegisterCheckout.js';
import { IDRegisterItem, type RegisterItem } from './RegisterItem.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = [];

    @field({ decoder: new ArrayDecoder(BalanceItemCartItem), optional: true })
    balanceItems: BalanceItemCartItem[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    deleteRegistrationIds: string[] = [];

    get organizationId() {
        if (this.items.length > 0) {
            return this.items[0].organizationId;
        }
        if (this.balanceItems.length > 0) {
            return this.balanceItems[0].item.organizationId;
        }
        // for deleted registrations, we don't have the id at the moment
        // that is not a disaster since we don't need to load these carts from storage
        return null;
    }

    hydrate(context: RegisterContext) {
        const cart = new RegisterCart();
        cart.items = this.items.map(i => i.hydrate(context));
        cart.balanceItems = this.balanceItems;

        const registrations: RegistrationWithPlatformMember[] = [];
        for (const registrationId of this.deleteRegistrationIds) {
            let found = false;
            for (const member of context.members) {
                const registration = member.patchedMember.registrations.find(r => r.id === registrationId);
                if (!registration) {
                    continue;
                }

                registrations.push(new RegistrationWithPlatformMember({
                    registration,
                    member,
                }));
                found = true;
                break;
            }

            if (!found) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Registration not found',
                    human: $t(`d05d3829-a5c2-426c-ae1d-3b0c9cacd536`),
                    field: 'deleteRegistrationIds',
                });
            }
        }
        cart.deleteRegistrations = registrations;

        return cart;
    }
}

export class RegisterCart {
    items: RegisterItem[] = [];
    balanceItems: BalanceItemCartItem[] = [];

    /**
     * You can define which registrations you want remove as part of this register operation.
     */
    deleteRegistrations: RegistrationWithPlatformMember[] = [];
    bundleDiscounts: BundleDiscountCalculation[] = [];

    calculatePrices() {
        for (const item of this.items) {
            item.calculatePrice();
        }

        // Now calculate discounts
        this.bundleDiscounts = [];
        if (this.singleOrganization) {
            for (const bundleDiscount of this.singleOrganization.period.settings.bundleDiscounts) {
                const grouped = bundleDiscount.calculate(this);
                for (const [_, calculation] of grouped.calculations) {
                    if (calculation.netTotal !== 0) {
                        this.bundleDiscounts.push(calculation);
                    }
                }
            }
        }
    }

    clone() {
        const cart = new RegisterCart();
        cart.items = this.items.map(i => i.clone());
        cart.balanceItems = this.balanceItems.map(i => i.clone());
        cart.deleteRegistrations = this.deleteRegistrations.map(r => r.clone());
        return cart;
    }

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert()),
            balanceItems: this.balanceItems,
            deleteRegistrationIds: this.deleteRegistrations.map(r => r.registration.id),
        });
    }

    add(item: RegisterItem) {
        if (this.contains(item)) {
            return this.remove(item, item);
        }

        if (!this.canAdd(item)) {
            return;
        }

        this.items.push(item);
    }

    canAdd(item: RegisterItem) {
        if (this.contains(item)) {
            return false;
        }

        if (this.items.length >= 500) {
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

    removeRegistration(registration: RegistrationWithPlatformMember) {
        const index = this.deleteRegistrations.findIndex(r => r.registration.id === registration.registration.id);
        if (index === -1) {
            this.deleteRegistrations.push(registration);
        }
    }

    unremoveRegistration(registration: RegistrationWithPlatformMember) {
        const index = this.deleteRegistrations.findIndex(r => r.registration.id === registration.registration.id);
        if (index !== -1) {
            this.deleteRegistrations.splice(index, 1);
        }
    }

    canAddBalanceItem(item: BalanceItemCartItem) {
        if (this.singleOrganization) {
            if (item.item.organizationId !== this.singleOrganization?.id) {
                return false;
            }
        }

        // Check duplicate
        for (const i of this.balanceItems) {
            if (i.item.id === item.item.id) {
                return false;
            }
        }

        return true;
    }

    addBalanceItem(item: BalanceItemCartItem) {
        if (!this.canAddBalanceItem(item)) {
            return;
        }

        this.balanceItems.push(item);
    }

    removeBalanceItem(item: BalanceItemCartItem) {
        for (let i = this.balanceItems.length - 1; i >= 0; i--) {
            if (this.balanceItems[i].id === item.id) {
                this.balanceItems.splice(i, 1);
            }
        }
    }

    get isEmpty() {
        return this.count === 0;
    }

    get count() {
        return this.items.length + this.balanceItems.length + this.deleteRegistrations.length;
    }

    get price() {
        return this.items.reduce((total, item) => item.calculatedPrice + total, 0)
            + this.balanceItems.reduce((total, item) => {
                return total + item.price;
            }, 0);
    }

    get priceDueLater() {
        return this.items.reduce((total, item) => item.calculatedPriceDueLater + total, 0);
    }

    /**
     * Discounts that will be applied to items that are due now
     */
    get bundleDiscount() {
        return this.bundleDiscounts.map(d => d.netTotalDueNow).reduce((a, b) => a + b, 0);
    }

    /**
         * Discounts that will be applied to items that are due later
         */
    get bundleDiscountDueLater() {
        return this.bundleDiscounts.map(d => d.netTotalDueLater).reduce((a, b) => a + b, 0);
    }

    get refund() {
        return this.items.reduce((total, item) => item.calculatedRefund + total, 0)
            + this.deleteRegistrations.reduce((total, item) => {
                return total + item.registration.calculatedPrice;
            }, 0);
    }

    getCancellationFees(cancellationFeePercentage: number) {
        return this.items.reduce((total, item) => this.calculateCancellationFee(item.calculatedRefund, cancellationFeePercentage) + total, 0)
            + this.deleteRegistrations.reduce((total, item) => {
                return total + this.calculateCancellationFee(item.registration.calculatedPrice, cancellationFeePercentage);
            }, 0);
    }

    calculateCancellationFee(price: number, cancellationFeePercentage: number) {
        const cancellationFee = Math.round(price * cancellationFeePercentage / 10000);
        return cancellationFee;
    }

    get singleOrganization() {
        if (this.items.length === 0) {
            if (this.deleteRegistrations.length > 0) {
                const organizationId = this.deleteRegistrations[0].registration.group.organizationId;
                return this.deleteRegistrations[0].member.organizations.find(o => o.id === organizationId) ?? null;
            }
            return null;
        }

        return this.items[0].organization;
    }

    validate(checkout: RegisterCheckout, data?: { memberBalanceItems?: BalanceItem[] }) {
        const newItems: RegisterItem[] = [];
        const errors = new SimpleErrors();
        for (const item of this.items) {
            try {
                item.validate({ final: true });
                item.cartError = null;
                newItems.push(item);

                const isDuplicate = !!this.items.find(i => i !== item && i.isSameRegistration(item));

                if (isDuplicate) {
                    errors.addError(new SimpleError({
                        code: 'duplicate_register_item',
                        message: 'duplicate register item',
                        human: $t(`9cddf872-df86-45d7-947d-3858d7187487`),
                    }));
                }
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart');
                    errors.addError(e);
                }
                else {
                    throw e;
                }

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item);
                }
            }
        }

        const cleanedBalanceItems: BalanceItemCartItem[] = [];
        for (const balanceItem of this.balanceItems) {
            // TODO: validate balance item organization (happens in backend anyway)
            if (checkout.singleOrganizationId && balanceItem.item.organizationId !== checkout.singleOrganizationId) {
                errors.addError(new SimpleError({
                    code: 'invalid_organization',
                    message: 'Invalid organization in balanceItems',
                    human: $t(`0e7fa0a8-7946-4f3a-b17e-a8949de7928d`),
                    field: 'balanceItems',
                }));
                continue;
            }

            try {
                balanceItem.validate({ balanceItems: data?.memberBalanceItems });
                cleanedBalanceItems.push(balanceItem);
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart');
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }

        const cleanedRegistrations: RegistrationWithPlatformMember[] = [];
        const singleOrganization = checkout.singleOrganization;

        for (const registration of this.deleteRegistrations) {
            if (checkout.singleOrganizationId && registration.registration.group.organizationId !== checkout.singleOrganizationId) {
                errors.addError(new SimpleError({
                    code: 'invalid_organization',
                    message: 'Invalid organization in deleteRegistrations',
                    human: $t(`dba1b316-9058-48af-be8e-e9e9d6615bde`),
                    field: 'deleteRegistrations',
                }));
                continue;
            }

            if (!singleOrganization) {
                continue;
            }

            const platform = Platform.shared;

            const periodId = registration.registration.group.periodId;
            const period = periodId === platform.period.id ? platform.period : (periodId === singleOrganization.period.period.id ? singleOrganization.period.period : registration.registration.group.settings.period);

            if (period && period.locked) {
                errors.addError(new SimpleError({
                    code: 'locked_period',
                    message: 'Locked period',
                    human: $t('662e1c09-b491-41a4-8e87-220fabc87eb1', { group: registration.registration.group.settings.name, period: period.nameShort }),
                }));
                continue;
            }

            if (!period) {
                errors.addError(new SimpleError({
                    code: 'locked_period',
                    message: 'Locked period',
                    human: $t('40670ad7-7db1-4ec9-84df-68b32642042e', { group: registration.registration.group.settings.name }),
                }));
                continue;
            }

            cleanedRegistrations.push(registration);
        }

        this.balanceItems = cleanedBalanceItems;
        this.deleteRegistrations = cleanedRegistrations;
        this.items = newItems;
        errors.throwIfNotEmpty();
    }
}
