import { AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder, URLDecoder } from '@simonbackx/simple-encoding';

import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import type { BalanceItem } from '../../BalanceItem.js';
import { type Group } from '../../Group.js';
import type { Organization } from '../../Organization.js';
import { PaymentCustomer } from '../../PaymentCustomer.js';
import { PaymentMethod } from '../../PaymentMethod.js';
import type { PriceBreakdown } from '../../PriceBreakdown.js';
import { type PlatformMember } from '../PlatformMember.js';
import type { BalanceItemCartItem } from './BalanceItemCartItem.js';
import { IDRegisterCart, RegisterCart } from './RegisterCart.js';
import type { RegisterItem } from './RegisterItem.js';
import { type RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../../upgradePriceFrom2To4DecimalPlaces.js';

export type RegisterContext = {
    members: PlatformMember[];
    groups: Group[];
    organizations: Organization[];
};

export class IDRegisterCheckout extends AutoEncoder {
    @field({ decoder: IDRegisterCart })
    cart: IDRegisterCart = IDRegisterCart.create({});

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    administrationFee = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    freeContribution = 0;

    @field({ decoder: IntegerDecoder, version: 362 })
    cancellationFeePercentage = 0;

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null;

    /**
     * The link we'll redirect the user back too after the payment page (either succeeded or failed!)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({ allowedProtocols: ['https:'] }), nullable: true })
    redirectUrl: URL | null = null;

    /**
     * The link we'll redirect the user back too after the user canceled a payment (not supported for all payment methods)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({ allowedProtocols: ['https:'] }), nullable: true })
    cancelUrl: URL | null = null;

    /**
     * Register these members as the organization
     */
    @field({ decoder: StringDecoder, nullable: true })
    asOrganizationId: string | null = null;

    @field({ decoder: PaymentCustomer, nullable: true, version: 322 })
    customer: PaymentCustomer | null = null;

    /**
     * Cached price so we can detect inconsistencies between frontend and backend
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    totalPrice: number | null = null;

    @field({ decoder: BooleanDecoder, version: 378 })
    sendConfirmationEmail: boolean = false;

    get organizationId() {
        return this.cart.organizationId;
    }

    hydrate(context: RegisterContext) {
        const checkout = new RegisterCheckout();
        checkout.cart = this.cart.hydrate(context);
        checkout.administrationFee = this.administrationFee;
        checkout.freeContribution = this.freeContribution;
        checkout.paymentMethod = this.paymentMethod;
        checkout.asOrganizationId = this.asOrganizationId;
        checkout.customer = this.customer;
        checkout.cancellationFeePercentage = this.cancellationFeePercentage;
        checkout.sendConfirmationEmail = this.sendConfirmationEmail;

        if (context.organizations[0] && !checkout.cart.isEmpty && checkout.defaultOrganization === null) {
            const preferredId = checkout.singleOrganizationId;
            checkout.setDefaultOrganization((preferredId ? context.organizations.find(o => o.id === preferredId) : null) ?? context.organizations[0]);
        }
        else {
            if (!checkout.cart.isEmpty && !checkout.singleOrganization) {
                throw new Error('Missing default organization');
            }
        }

        return checkout;
    }

    get memberIds() {
        return Formatter.uniqueArray(this.cart.items.map(i => i.memberId));
    }

    get groupIds() {
        return Formatter.uniqueArray(this.cart.items.map(i => i.groupId));
    }
}

export class RegisterCheckout {
    cart = new RegisterCart();
    administrationFee = 0;
    freeContribution = 0;
    paymentMethod: PaymentMethod | null = null;
    customer: PaymentCustomer | null = null;
    asOrganizationId: string | null = null;

    /**
     * Only allowed to be changed when isAdminFromSameOrganization
     */
    sendConfirmationEmail = false; // Whether to send a confirmation email to the user after registration

    // Default hint for empty carts to know the organization to use
    defaultOrganization: Organization | null = null;

    cancellationFeePercentage = 0; // per ten thousand

    /**
     * Note: only use this for temporary clones,
     * because the register items will still have a reference to the old checkout.
     */
    clone() {
        const checkout = new RegisterCheckout();
        checkout.cart = this.cart.clone();
        checkout.administrationFee = this.administrationFee;
        checkout.freeContribution = this.freeContribution;
        checkout.paymentMethod = this.paymentMethod;
        checkout.asOrganizationId = this.asOrganizationId;
        checkout.customer = this.customer ? this.customer.clone() : null;
        checkout.cancellationFeePercentage = this.cancellationFeePercentage;
        checkout.defaultOrganization = this.defaultOrganization;

        return checkout;
    }

    convert(): IDRegisterCheckout {
        return IDRegisterCheckout.create({
            cart: this.cart.convert(),
            administrationFee: this.administrationFee,
            freeContribution: this.freeContribution,
            paymentMethod: this.paymentMethod,
            totalPrice: this.totalPrice,
            cancellationFeePercentage: this.cancellationFeePercentage,
            asOrganizationId: this.asOrganizationId,
            customer: this.customer,
            sendConfirmationEmail: this.sendConfirmationEmail,
        });
    }

    get singleOrganization() {
        return this.cart.singleOrganization ?? this.defaultOrganization;
    }

    get singleOrganizationId() {
        return this.singleOrganization?.id ?? this.cart.deleteRegistrations[0]?.registration.organizationId ?? this.cart.balanceItems[0]?.item.organizationId;
    }

    setDefaultOrganization(organization: Organization | null) {
        this.defaultOrganization = organization;
    }

    get isAdminFromSameOrganization() {
        return !!this.asOrganizationId && this.asOrganizationId === this.singleOrganization?.id;
    }

    add(item: RegisterItem, options?: { calculate?: boolean }) {
        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }

        if (!this.singleOrganization) {
            this.setDefaultOrganization(item.organization);
        }
        this.cart.add(item);

        if (options?.calculate !== false) {
            this.updatePrices();
        }
    }

    remove(item: RegisterItem, options?: { calculate?: boolean }) {
        this.cart.remove(item);

        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    removeMemberAndGroup(memberId: string, groupId: string, options?: { calculate?: boolean }) {
        this.cart.removeMemberAndGroup(memberId, groupId);
        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    removeRegistration(registration: RegistrationWithPlatformMember, options?: { calculate?: boolean }) {
        this.cart.removeRegistration(registration);

        if (this.cart.deleteRegistrations.length === 1) {
            // Set the default cancellation fee
            if (registration.registration.balances.reduce((total, balance) => total + balance.amountPaid + balance.amountPending, 0) > 0) {
                // Already paid. By default we try to be undestructive. This means not refunding the already paid amount
                this.cancellationFeePercentage = 100_00;
            }
            else {
                // Not yet paid, by default we are undescructive. This means we try to 'refund' the already paid amount. Since it is not paid, this is no-op
                this.cancellationFeePercentage = 0;
            }
        }
        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    unremoveRegistration(registration: RegistrationWithPlatformMember, options?: { calculate?: boolean }) {
        this.cart.unremoveRegistration(registration);
        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    addBalanceItem(item: BalanceItemCartItem, options?: { calculate?: boolean }) {
        this.cart.addBalanceItem(item);

        if (options?.calculate !== false) {
            this.updatePrices();
        }
    }

    removeBalanceItem(item: BalanceItemCartItem, options?: { calculate?: boolean }) {
        this.cart.removeBalanceItem(item);

        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    removeBalanceItemByBalance(item: BalanceItem, options?: { calculate?: boolean }) {
        const _item = this.cart.balanceItems.find(i => i.item.id === item.id);
        if (!_item) {
            return;
        }
        this.removeBalanceItem(_item, options);
    }

    updatePrices() {
        this.cart.calculatePrices();

        if (this.isAdminFromSameOrganization || !this.singleOrganization) {
            this.administrationFee = 0;
        }
        else {
            this.administrationFee = this.singleOrganization.meta.registrationPaymentConfiguration.administrationFee.calculate(this.cart.price - this.bundleDiscount - this.cart.refund) ?? 0;
        }
    }

    validate(data: { memberBalanceItems?: BalanceItem[] }) {
        if (!this.isAdminFromSameOrganization && this.cart.deleteRegistrations.length > 0) {
            throw new SimpleError({
                code: 'forbidden',
                message: 'Permission denied: you are not allowed to delete registrations',
                human: $t(`%qr`),
            });
        }

        this.cart.validate(this, data);
        this.updatePrices();

        if (this.singleOrganization && (this.singleOrganization.meta.recordsConfiguration.freeContribution?.amounts.length ?? 0) === 0) {
            // Automatically clear free contribution if there are no options
            this.freeContribution = 0;
        }

        if (this.cancellationFeePercentage > 100_00 || this.cancellationFeePercentage < 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'cancellationFeePercentage',
                message: 'Invalid cancellation fee percentage',
            });
        }

        if (!this.isAdminFromSameOrganization) {
            if (this.totalPrice < 0) {
                // If the total price is negative, we cannot charge the user
                throw new SimpleError({
                    code: 'negative_price',
                    message: 'Total price cannot be negative',
                    human: $t(`%17E`),
                });
            }
        }
    }

    clear() {
        this.administrationFee = 0;
        this.freeContribution = 0;
        this.cart.items = [];
        this.cart.balanceItems = [];
        this.cart.deleteRegistrations = [];
        this.cart.bundleDiscounts = [];
        this.customer = null;
    }

    /**
     * Only includes 'due now' items - so excludes trials (doesn't work 100% yet with deleted registrations but this is not a problem at the moment)
     */
    get totalPrice() {
        return this.cart.price - this.bundleDiscount - this.cart.refund + this.administrationFee + this.freeContribution + this.cart.getCancellationFees(this.cancellationFeePercentage);
    }

    /**
     * Discounts that will be applied to items that are due now
     * (net, so minus the already applied discounts)
     */
    get bundleDiscount() {
        return this.cart.bundleDiscount;
    }

    /**
     * Discounts that will be applied to items that are due later
     * (net, so minus the already applied discounts)
     */
    get bundleDiscountDueLater() {
        return this.cart.bundleDiscountDueLater;
    }

    get priceBreakown(): PriceBreakdown {
        const all: PriceBreakdown = [];

        // Discounts
        for (const discount of this.cart.bundleDiscounts) {
            const value = discount.netTotal;
            if (value !== 0) {
                if (value < 0) {
                    all.push({
                        name: $t('%175') + ' (' + discount.name + ')',
                        price: -value,
                    });
                }
                else {
                    all.push({
                        name: discount.name,
                        price: -value,
                    });
                }
            }
        }

        all.push(...[
            {
                name: $t(`%17F`),
                price: -this.cart.refund,
            },
            {
                name: $t(`%qs`),
                price: this.administrationFee,
            },
            {
                name: $t(`%Ot`),
                price: this.freeContribution,
            },
            {
                name: $t(`%17G`),
                price: this.cart.getCancellationFees(this.cancellationFeePercentage),
            },
        ].filter(a => a.price !== 0));

        if (all.length > 0 && (this.cart.price + this.cart.priceDueLater) !== 0) {
            all.unshift({
                name: $t(`%xJ`),
                price: this.cart.price + this.cart.priceDueLater,
            });
        }

        const totalLater = this.cart.priceDueLater - this.bundleDiscountDueLater;

        if (totalLater !== 0) {
            all.push(
                {
                    name: $t(`%10Z`),
                    price: totalLater,
                },
            );
        }

        if (this.isAdminFromSameOrganization) {
            all.push({
                name: (this.totalPrice >= 0 ? $t('%vb') : $t('%vc')),
                price: Math.abs(this.totalPrice),
            });
        }
        else {
            all.push({
                name: this.cart.priceDueLater ? $t(`%10c`) : $t(`%xL`),
                price: this.totalPrice,
            });
        }

        return all;
    }
}
