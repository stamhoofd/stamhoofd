import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Payment, PrivatePayment } from './members/Payment.js';
import { PriceBreakdown } from './PriceBreakdown.js';

export enum BalanceItemStatus {
    /**
     * The balance is not yet owed by the member (payment is optional and not visible). But it is paid, the status will change to 'paid'.
     */
    Hidden = 'Hidden',

    /**
     * @deprecated: try to remove usage and use negative 'Hidden' check for now. Pending and Paid status will get merged
     * The balance is owed by the member, but not yet (fully) paid by the member.
     */
    Pending = 'Pending',

    /**
     * @deprecated: try to remove usage and use negative 'Hidden' check for now. Pending and Paid status will get merged
     * The balance has been paid by the member. All settled.
     */
    Paid = 'Paid',
}

export enum BalanceItemType {
    Registration = 'Registration',
    AdministrationFee = 'AdministrationFee',
    FreeContribution = 'FreeContribution',
    Order = 'Order',
    Other = 'Other',
    PlatformMembership = 'PlatformMembership',
}

export function getBalanceItemTypeName(type: BalanceItemType): string {
    switch (type) {
        case BalanceItemType.Registration: return 'Inschrijving';
        case BalanceItemType.AdministrationFee: return 'Administratiekosten';
        case BalanceItemType.FreeContribution: return 'Vrije bijdrage';
        case BalanceItemType.Order: return 'Webshopbestelling';
        case BalanceItemType.Other: return 'Andere';
        case BalanceItemType.PlatformMembership: return 'Aansluiting';
    }
}

export function getBalanceItemTypeIcon(type: BalanceItemType): string | null {
    switch (type) {
        case BalanceItemType.Registration: return 'membership-filled';
        case BalanceItemType.AdministrationFee: return 'calculator';
        case BalanceItemType.FreeContribution: return 'gift';
        case BalanceItemType.Order: return 'basket';
        case BalanceItemType.Other: return 'card';
        case BalanceItemType.PlatformMembership: return 'membership-filled';
    }
    return null;
}

export enum BalanceItemRelationType {
    Webshop = 'Webshop', // Contains the name of the webshop
    Group = 'Group', // Contains the name of the group you registered for
    GroupPrice = 'GroupPrice', // Contains the price of the group you registered for
    GroupOptionMenu = 'GroupOptionMenu', // Contains the option menu that was chosen for the group
    GroupOption = 'GroupOption', // Contains the option that was chosen for the group
    Member = 'Member', // Contains the name of the member you registered
    MembershipType = 'MembershipType',
}

export function getBalanceItemRelationTypeName(type: BalanceItemRelationType): string {
    switch (type) {
        case BalanceItemRelationType.Webshop: return 'Webshop';
        case BalanceItemRelationType.Group: return 'Inschrijving';
        case BalanceItemRelationType.GroupPrice: return 'Tarief';
        case BalanceItemRelationType.GroupOptionMenu: return 'Keuzemenu';
        case BalanceItemRelationType.GroupOption: return 'Keuze';
        case BalanceItemRelationType.Member: return 'Lid';
        case BalanceItemRelationType.MembershipType: return 'Aansluitingstype';
    }
}

export function getBalanceItemRelationTypeDescription(type: BalanceItemRelationType): string {
    switch (type) {
        case BalanceItemRelationType.Webshop: return 'Webshop geassocieerd aan dit item';
        case BalanceItemRelationType.Group: return 'Naam van de groep of activiteit geassocieerd aan dit item';
        case BalanceItemRelationType.GroupPrice: return 'Tarief dat gekozen werd voor de groep of activiteit';
        case BalanceItemRelationType.GroupOptionMenu: return 'Naam van het keuzemenu waaruit gekozen werd';
        case BalanceItemRelationType.GroupOption: return 'De gekozen optie van het keuzemenu waarvoor betaald werd. Als er meerdere keuzes gekozen werden, dan wordt er per keuze een apart item aangemaakt.';
        case BalanceItemRelationType.Member: return 'Naam van het lid geassocieerd aan dit item';
        case BalanceItemRelationType.MembershipType: return 'Naam van het aansluitingstype geassocieerd aan dit item';
    }
}

export function shouldAggregateOnRelationType(type: BalanceItemRelationType, allRelations: Map<BalanceItemRelationType, BalanceItemRelation>): boolean {
    switch (type) {
        case BalanceItemRelationType.GroupPrice:
            // Only aggregate on group price if it is not for a specific option (we'll combine all options in one group, regardless of the corresponding groupPrice)
            return !allRelations.has(BalanceItemRelationType.GroupOption);
        case BalanceItemRelationType.Member: return true;
    }
    return false;
}

/**
 * Helps you understand what a balance item is for. It can be for multiple things at the same time, e.g. when it is an option to buy a ticket, it is also a ticket.
 */
export class BalanceItemRelation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';
}

export class BalanceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(BalanceItemType), version: 307 })
    type = BalanceItemType.Other;

    @field({ decoder: new MapDecoder(new EnumDecoder(BalanceItemRelationType), BalanceItemRelation), version: 307 })
    relations: Map<BalanceItemRelationType, BalanceItemRelation> = new Map();

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: IntegerDecoder, version: 307 })
    amount = 1;

    @field({ decoder: IntegerDecoder, field: 'price' })
    @field({ decoder: IntegerDecoder, field: 'unitPrice', version: 307 })
    unitPrice = 0; // unit price

    get price() {
        return this.unitPrice * this.amount;
    }

    get priceOpen() {
        return this.price - this.pricePaid - this.pricePending;
    }

    @field({ decoder: IntegerDecoder })
    pricePaid = 0;

    @field({ decoder: IntegerDecoder, version: 335 })
    pricePending = 0;

    @field({ decoder: DateDecoder, nullable: true, ...NextVersion })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: new EnumDecoder(BalanceItemStatus) })
    status: BalanceItemStatus = BalanceItemStatus.Pending;

    get isPaid() {
        return this.pricePaid === this.price;
    }

    @field({ decoder: StringDecoder })
    organizationId = '';

    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    registrationId: string | null = null;

    get paymentShortDescription(): string {
        switch (this.type) {
            case BalanceItemType.Registration: {
                return this.relations.get(BalanceItemRelationType.Group)?.name ?? 'inschrijving';
            }
            case BalanceItemType.AdministrationFee: return 'administratiekosten';
            case BalanceItemType.FreeContribution: return 'vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name ?? 'webshop';
            case BalanceItemType.Other: return 'andere';
            case BalanceItemType.PlatformMembership: return this.relations.get(BalanceItemRelationType.MembershipType)?.name ?? 'aansluitingen';
        }
    }

    /**
     * To help split payments in categories: return a more detailed category than purely the type
     */
    get category(): string {
        switch (this.type) {
            case BalanceItemType.Registration: {
                return this.relations.get(BalanceItemRelationType.Group)?.name ?? 'onbekende inschrijvingsgroep';
            }
            case BalanceItemType.AdministrationFee: return 'administratiekosten';
            case BalanceItemType.FreeContribution: return 'vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name ?? 'onbekende webshop';
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return this.relations.get(BalanceItemRelationType.MembershipType)?.name ?? 'aansluitingen';
        }
    }

    get groupPrefix(): string {
        return this.itemPrefix;
    }

    get groupTitle(): string {
        return this.itemTitle;
    }

    get groupDescription() {
        return null;
    }

    get priceBreakown(): PriceBreakdown {
        const all = [
            {
                name: 'Reeds betaald',
                price: this.pricePaid,
            },
            {
                name: 'In verwerking',
                price: this.pricePending,
            },
        ].filter(a => a.price !== 0);

        if (all.length > 0) {
            all.unshift({
                name: 'Totaalprijs',
                price: this.price,
            });
        }

        return [
            ...all,
            {
                name: this.priceOpen < 0 ? 'Terug te krijgen' : 'Te betalen',
                price: Math.abs(this.priceOpen),
            },
        ];
    }

    /**
     * Unique identifier whithing a reporting group
     */
    get groupCode() {
        if (this.type === BalanceItemType.Other) {
            return 'type-' + this.type
                + '-unit-price-' + this.unitPrice
                + '-description-' + this.description;
        }

        return 'type-' + this.type
            + '-unit-price-' + this.unitPrice
            + '-relations' + Array.from(this.relations.entries())
            .filter(([key]) => !shouldAggregateOnRelationType(key, this.relations))
            .map(([key, value]) => key + '-' + value.id)
            .join('-');
    }

    /**
     * When displayed as a single item
     */
    get itemPrefix(): string {
        const prefix = this.amount === 0 ? 'Geannuleerde ' : '';

        switch (this.type) {
            case BalanceItemType.Registration: {
                if (this.relations.get(BalanceItemRelationType.GroupOption)) {
                    const group = this.relations.get(BalanceItemRelationType.Group)?.name || 'onbekende inschrijvingsgroep';
                    return prefix + 'inschrijving voor ' + group;
                }
                return prefix + 'inschrijving';
            }
            case BalanceItemType.AdministrationFee: return prefix + 'administratiekosten';
            case BalanceItemType.FreeContribution: return prefix + 'vrije bijdrage';
            case BalanceItemType.Order: return prefix + 'bestelling';
            case BalanceItemType.Other: return prefix + 'andere';
            case BalanceItemType.PlatformMembership: return prefix + 'aansluiting';
        }
    }

    /**
     * When displayed as a single item
     */
    get itemTitle(): string {
        switch (this.type) {
            case BalanceItemType.Registration: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                if (option) {
                    const optionMenu = this.relations.get(BalanceItemRelationType.GroupOptionMenu);
                    return (optionMenu?.name ?? 'Onbekend') + ': ' + option.name;
                }
                const group = this.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                const price = this.relations.get(BalanceItemRelationType.GroupPrice)?.name;
                return group + (price && price !== 'Standaardtarief' ? ' (' + price + ')' : '');
            }
            case BalanceItemType.AdministrationFee: return 'Administratiekosten';
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name || 'Onbekende webshop';
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return this.relations.get(BalanceItemRelationType.MembershipType)?.name || 'Onbekend aansluitingstype';
        }
    }

    /**
     * When displayed as a single item
     */
    get itemDescription() {
        switch (this.type) {
            case BalanceItemType.Registration: {
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return member.name;
                }
                return null;
            }
            case BalanceItemType.PlatformMembership: {
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return member.name;
                }
            }
        }
        return null;
    }
}

export class BalanceItemPayment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: IntegerDecoder })
    price: number;
}

export class BalanceItemPaymentWithPayment extends BalanceItemPayment {
    @field({ decoder: Payment })
    payment: Payment;
}

export class BalanceItemPaymentWithPrivatePayment extends BalanceItemPayment {
    @field({ decoder: PrivatePayment })
    payment: PrivatePayment;
}

export class BalanceItemWithPayments extends BalanceItem {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPayment) })
    payments: BalanceItemPaymentWithPayment[] = [];

    updatePricePaid() {
        this.pricePaid = this.payments.reduce((total, payment) => total + (payment.payment.isSucceeded ? payment.price : 0), 0);
    }

    /**
     * Return whether a payment has been initiated for this balance item
     */
    get hasPendingPayment() {
        return !!this.payments.find(p => p.payment.isPending);
    }

    static getOutstandingBalance(items: BalanceItemWithPayments[]) {
        // Get sum of balance payments
        const totalPending = items.map(p => p.pricePending).reduce((t, total) => total + t, 0);
        const totalPaid = items.map(p => p.pricePaid).reduce((t, total) => total + t, 0);
        const totalPrice = items.map(p => p.price).reduce((t, total) => total + t, 0);

        const total = totalPrice - totalPaid;
        const totalOpen = total - totalPending;

        return {
            /**
             * @deprecated
             */
            totalPending, // Pending payment
            /**
             * @deprecated
             */
            totalOpen, // Not yet started
            /**
             * @deprecated
             */
            total: totalPending + totalOpen, // total not yet paid

            price: totalPrice,
            pricePending: totalPending,
            priceOpen: totalOpen,
            pricePaid: totalPaid,
        };
    }
}

export class BalanceItemWithPrivatePayments extends BalanceItemWithPayments {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPrivatePayment) })
    payments: BalanceItemPaymentWithPrivatePayment[] = [];
}
