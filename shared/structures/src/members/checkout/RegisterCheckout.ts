import { AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder, URLDecoder } from '@simonbackx/simple-encoding';

import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItem } from '../../BalanceItem.js';
import { Group } from '../../Group.js';
import { Organization } from '../../Organization.js';
import { PaymentCustomer } from '../../PaymentCustomer.js';
import { PaymentMethod } from '../../PaymentMethod.js';
import { PriceBreakdown } from '../../PriceBreakdown.js';
import { PlatformMember } from '../PlatformMember.js';
import { RegistrationWithMember } from '../RegistrationWithMember.js';
import { BalanceItemCartItem } from './BalanceItemCartItem.js';
import { IDRegisterCart, RegisterCart } from './RegisterCart.js';
import { RegisterItem } from './RegisterItem.js';

export type RegisterContext = {
    members: PlatformMember[];
    groups: Group[];
    organizations: Organization[];
};

export class IDRegisterCheckout extends AutoEncoder {
    @field({ decoder: IDRegisterCart })
    cart: IDRegisterCart = IDRegisterCart.create({});

    @field({ decoder: IntegerDecoder })
    administrationFee = 0;

    @field({ decoder: IntegerDecoder })
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
    totalPrice: number | null = null;

    hydrate(context: RegisterContext) {
        const checkout = new RegisterCheckout();
        checkout.cart = this.cart.hydrate(context);
        checkout.administrationFee = this.administrationFee;
        checkout.freeContribution = this.freeContribution;
        checkout.paymentMethod = this.paymentMethod;
        checkout.asOrganizationId = this.asOrganizationId;
        checkout.customer = this.customer;
        checkout.cancellationFeePercentage = this.cancellationFeePercentage;

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

    // Default hint for empty carts to know the organization to use
    defaultOrganization: Organization | null = null;

    cancellationFeePercentage = 0; // per ten thousand

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
        });
    }

    get singleOrganization() {
        return this.cart.singleOrganization ?? this.defaultOrganization;
    }

    get singleOrganizationId() {
        return this.singleOrganization?.id ?? this.cart.deleteRegistrations[0]?.organizationId ?? this.cart.balanceItems[0]?.item.organizationId;
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

    removeRegistration(registration: RegistrationWithMember, options?: { calculate?: boolean }) {
        this.cart.removeRegistration(registration);
        if (options?.calculate !== false) {
            this.updatePrices();
        }

        if (this.cart.isEmpty) {
            this.defaultOrganization = null;
        }
    }

    unremoveRegistration(registration: RegistrationWithMember, options?: { calculate?: boolean }) {
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
            this.administrationFee = this.singleOrganization.meta.registrationPaymentConfiguration.administrationFee.calculate(this.cart.price) ?? 0;
        }
    }

    validate(data: { memberBalanceItems?: BalanceItem[] }) {
        if (!this.isAdminFromSameOrganization && this.cart.deleteRegistrations.length > 0) {
            throw new SimpleError({
                code: 'forbidden',
                message: 'Permission denied: you are not allowed to delete registrations',
                human: $t(`9889c815-5026-4b38-b62a-bb1e438e82b0`),
            });
        }

        this.cart.validate(this, data);

        if (this.singleOrganization && (this.singleOrganization.meta.recordsConfiguration.freeContribution?.amounts.length ?? 0) === 0) {
            // Automatically clear free contribution if there are no options
            this.freeContribution = 0;
        }
    }

    clear() {
        this.administrationFee = 0;
        this.freeContribution = 0;
        this.cart.items = [];
        this.cart.balanceItems = [];
        this.cart.deleteRegistrations = [];
        this.customer = null;
    }

    get totalPrice() {
        return Math.max(0, this.cart.price + this.administrationFee + this.freeContribution - this.cart.refund);
    }

    get priceBreakown(): PriceBreakdown {
        const all = [
            {
                name: $t(`307f8b34-7f74-4045-9335-c7f0d7649b70`),
                price: this.administrationFee,
            },
            {
                name: $t(`16ca0372-9c8f-49f0-938d-aee012e59f8c`),
                price: this.freeContribution,
            },
            {
                name: $t(`35443bbe-49e8-488e-bb71-c28f30d63f4a`),
                price: -this.cart.refund,
            },
            {
                name: $t(`7e1d2f82-ca2d-4acc-ab37-88834e63c999`),
                price: this.cart.priceDueLater,
            },
        ].filter(a => a.price !== 0);

        if (all.length > 0) {
            all.unshift({
                name: $t(`8a04f032-01e5-4ee0-98fb-6f36bf971080`),
                price: this.cart.price,
            });
        }

        return [
            ...all,
            {
                name: this.cart.priceDueLater ? $t(`bedb1bf7-9b38-4ef4-a1f3-53ade0f56352`) : $t(`e67d0122-6f15-46c6-af94-92a79268710a`),
                price: this.totalPrice,
            },
        ];
    }
}
