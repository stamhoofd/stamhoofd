import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Formatter, Sorter } from '@stamhoofd/utility';
import { Payment, PrivatePayment } from './members/Payment.js';
import { PriceBreakdown } from './PriceBreakdown.js';

export enum BalanceItemStatusV352 {
    Hidden = 'Hidden',
    Pending = 'Pending',
    Paid = 'Paid',
}

export enum BalanceItemStatus {
    /**
     * The balance is not yet due, but it can be paid. As soon as it is paid, it will transform into 'Due' and automatic status changes can happen to connected resources.
     */
    Hidden = 'Hidden',

    /**
     * This means payment of the amount is a requirement.
    */
    Due = 'Due',

    /**
     * This means the balance is no longer due. If there is any paid amount, it is refundable.
     * In case you don't want to refund the amount, you should change the status to 'Due' and change the amount to the amount that is not refundable.
    */
    Canceled = 'Canceled',
}

export enum BalanceItemType {
    Registration = 'Registration',
    AdministrationFee = 'AdministrationFee',
    FreeContribution = 'FreeContribution',
    Order = 'Order',
    Other = 'Other',
    PlatformMembership = 'PlatformMembership',
    CancellationFee = 'CancellationFee',
}

export function getBalanceItemStatusName(type: BalanceItemStatus): string {
    switch (type) {
        case BalanceItemStatus.Hidden: return 'Verborgen';
        case BalanceItemStatus.Due: return 'Vervallen';
        case BalanceItemStatus.Canceled: return 'Geannuleerd';
    }
}

export function getBalanceItemTypeName(type: BalanceItemType): string {
    switch (type) {
        case BalanceItemType.Registration: return 'Inschrijving';
        case BalanceItemType.AdministrationFee: return 'Administratiekosten';
        case BalanceItemType.FreeContribution: return 'Vrije bijdrage';
        case BalanceItemType.Order: return 'Webshopbestelling';
        case BalanceItemType.Other: return 'Andere';
        case BalanceItemType.PlatformMembership: return 'Aansluiting';
        case BalanceItemType.CancellationFee: return 'Annuleringskosten';
    }
}

export function getBalanceItemTypeIcon(type: BalanceItemType): string | null {
    switch (type) {
        case BalanceItemType.Registration: return 'membership-filled';
        case BalanceItemType.AdministrationFee: return 'calculator';
        case BalanceItemType.FreeContribution: return 'gift';
        case BalanceItemType.Order: return 'basket';
        case BalanceItemType.Other: return 'box';
        case BalanceItemType.PlatformMembership: return 'membership-filled';
        case BalanceItemType.CancellationFee: return 'canceled';
    }
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

export function doBalanceItemRelationsMatch(a: Map<BalanceItemRelationType, BalanceItemRelation>, b: Map<BalanceItemRelationType, BalanceItemRelation>, allowedDifference = 0) {
    if (allowedDifference === 0 && a.size !== b.size) {
        return false;
    }

    if (a.size === 0 || b.size === 0) {
        return false;
    }

    allowedDifference = Math.min(allowedDifference, a.size, b.size);

    let differences = 0;

    for (const [key, value] of a.entries()) {
        const other = b.get(key);
        if (!other || other.id !== value.id) {
            differences++;

            if (differences > allowedDifference) {
                return false;
            }
        }
    }

    for (const [key] of b.entries()) {
        const other = a.get(key);
        if (other) {
            // Already handled in previous loop
            continue;
        }

        differences++;

        if (differences > allowedDifference) {
            return false;
        }
    }

    return true;
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
        if (this.status === BalanceItemStatus.Hidden || this.status === BalanceItemStatus.Canceled) {
            return 0;
        }
        return this.unitPrice * this.amount;
    }

    get priceOpen() {
        if (this.status === BalanceItemStatus.Hidden || this.status === BalanceItemStatus.Canceled) {
            return -this.pricePaid - this.pricePending;
        }
        return this.price - this.pricePaid - this.pricePending;
    }

    @field({ decoder: IntegerDecoder })
    pricePaid = 0;

    @field({ decoder: IntegerDecoder, version: 335 })
    pricePending = 0;

    @field({ decoder: DateDecoder, nullable: true, version: 353 })
    dueAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: new EnumDecoder(BalanceItemStatusV352) })
    @field({ decoder: new EnumDecoder(BalanceItemStatus), version: 353,
        upgrade(old) {
            switch (old) {
                case BalanceItemStatusV352.Pending: return BalanceItemStatus.Due;
                case BalanceItemStatusV352.Paid: return BalanceItemStatus.Due;
            }
            return old as BalanceItemStatus;
        },
        downgrade(newer) {
            switch (newer) {
                case BalanceItemStatus.Due: return BalanceItemStatusV352.Pending;
                case BalanceItemStatus.Canceled: return BalanceItemStatusV352.Pending;
            }
            return newer as BalanceItemStatusV352;
        },
    })
    status: BalanceItemStatus = BalanceItemStatus.Due;

    get isPaid() {
        return this.pricePaid === this.price;
    }

    get isDue() {
        if (this.status === BalanceItemStatus.Hidden || this.status === BalanceItemStatus.Canceled) {
            if (this.priceOpen !== 0) {
                // A paid amount remaining
                return true;
            }
            return false;
        }

        return this.dueAt === null || this.dueAt <= BalanceItem.getDueOffset();
    }

    get isOverDue() {
        return this.priceOpen > 0 && this.dueAt !== null && this.dueAt <= new Date();
    }

    @field({ decoder: StringDecoder })
    organizationId = '';

    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    registrationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 353 })
    payingOrganizationId: string | null = null;

    static getDueOffset(from: Date = new Date()) {
        const d = new Date(from.getTime() + 1000 * 60 * 60 * 24 * 7); // Added to outstanding balance 7 days before due date

        // Set time to midnight in Brussels timezone
        const l = Formatter.luxon(d);
        l.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

        return l.toJSDate();
    }

    static getOutstandingBalance(items: BalanceItem[]) {
        // Get sum of balance payments
        const totalPending = items.map(p => p.pricePending).reduce((t, total) => total + t, 0);
        const totalPaid = items.map(p => p.pricePaid).reduce((t, total) => total + t, 0);
        const totalPrice = items.map(p => p.price).reduce((t, total) => total + t, 0);
        const totalOpen = items.map(p => p.priceOpen).reduce((t, total) => total + t, 0);

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

    static filterBalanceItems(items: BalanceItem[]) {
        return items.filter(i => BalanceItem.getOutstandingBalance([i]).priceOpen !== 0).sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.dueAt ?? new Date(0), a.dueAt ?? new Date(0)),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
    }

    get paymentShortDescription(): string {
        // This doesn't list individual options
        switch (this.type) {
            case BalanceItemType.Registration: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                const group = this.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';

                if (option) {
                    return 'keuzeoptie voor ' + group;
                }

                return 'inschrijving voor ' + group;
            }
            case BalanceItemType.CancellationFee: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                const group = this.relations.get(BalanceItemRelationType.Group)?.name;

                if (group) {
                    if (option) {
                        return 'annuleringskost voor keuzeoptie bij ' + group;
                    }

                    return 'annuleringskost voor inschrijving bij ' + group;
                }
                return 'annuleringskost';
            }
            case BalanceItemType.AdministrationFee: return 'administratiekosten';
            case BalanceItemType.FreeContribution: return 'vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name || 'onbekende webshop';
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return 'aansluiting voor ' + this.relations.get(BalanceItemRelationType.MembershipType)?.name || 'onbekend aansluitingstype';
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
            case BalanceItemType.CancellationFee: return this.relations.get(BalanceItemRelationType.Group)?.name ?? this.relations.get(BalanceItemRelationType.Webshop)?.name ?? this.relations.get(BalanceItemRelationType.MembershipType)?.name ?? 'annuleringskosten';
            case BalanceItemType.AdministrationFee: return 'administratiekosten';
            case BalanceItemType.FreeContribution: return 'vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name ?? 'onbekende webshop';
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return this.relations.get(BalanceItemRelationType.MembershipType)?.name ?? 'aansluitingen';
        }
    }

    get groupTitle(): string {
        return this.itemTitle;
    }

    get groupDescription() {
        switch (this.type) {
            case BalanceItemType.Registration: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                if (option) {
                    const group = this.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                    return 'Keuzeoptie ' + group;
                }
                break;
            }
            case BalanceItemType.CancellationFee: {
                const list: string[] = [];
                // List all relations
                for (const [key, value] of this.relations.entries()) {
                    if (shouldAggregateOnRelationType(key, this.relations)) {
                        list.push(getBalanceItemRelationTypeName(key) + ': ' + value.name);
                    }
                }
                return list.join('\n');
            }
        }
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
                name: this.priceOpen < 0 ? 'Terug te betalen' : 'Te betalen',
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
                + '-' + this.status
                + '-unit-price-' + this.unitPrice
                + '-description-' + this.description
                + '-due-date-' + (this.dueAt ? Formatter.dateIso(this.dueAt) : 'null');
        }

        return 'type-' + this.type
            + '-' + this.status
            + '-unit-price-' + this.unitPrice
            + '-due-date-' + (this.dueAt ? Formatter.dateIso(this.dueAt) : 'null')
            + '-relations' + Array.from(this.relations.entries())
            .filter(([key]) => !shouldAggregateOnRelationType(key, this.relations))
            .map(([key, value]) => key + '-' + value.id)
            .join('-');
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
                return 'Inschrijving voor ' + group + (price && price !== 'Standaardtarief' ? ' (' + price + ')' : '');
            }
            case BalanceItemType.CancellationFee: return 'Annuleringskosten';
            case BalanceItemType.AdministrationFee: return 'Administratiekosten';
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage';
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name || 'Onbekende webshop';
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return 'Aansluiting voor ' + this.relations.get(BalanceItemRelationType.MembershipType)?.name || 'Onbekend aansluitingstype';
        }
    }

    /**
     * When displayed as a single item
     */
    get itemDescription() {
        switch (this.type) {
            case BalanceItemType.Registration: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                let prefix = '';
                if (option) {
                    const group = this.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                    prefix = 'Keuzeoptie ' + group;
                }
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return (prefix ? (prefix + '\n') : '') + member.name;
                }
                return prefix;
            }
            case BalanceItemType.PlatformMembership: {
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return member.name;
                }
                break;
            }
            case BalanceItemType.CancellationFee: {
                const list: string[] = [];
                // List all relations
                for (const [key, value] of this.relations.entries()) {
                    list.push(getBalanceItemRelationTypeName(key) + ': ' + value.name);
                }
                return list.join('\n');
            }
        }
        return null;
    }

    static getDetailsHTMLTable(items: BalanceItem[]): string {
        const grouped = GroupedBalanceItems.group(BalanceItem.filterBalanceItems(items));

        if (grouped.length === 0) {
            return '<p class="description">Geen openstaand bedrag</p>';
        }

        let str = '';
        str += `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

        for (const item of grouped) {
            let prefix = '';
            let prefixClass = '';
            const title = item.itemTitle;
            let description = Formatter.escapeHtml(item.itemDescription ?? '');
            let price = '';

            if (item.dueAt) {
                prefix = `Te betalen tegen ${Formatter.date(item.dueAt)}`;

                if (item.isOverDue) {
                    prefixClass = 'error';
                }
            }
            else if (item.status === BalanceItemStatus.Canceled) {
                prefix = 'Geannuleerd';
                prefixClass = 'error';
            }
            else if (item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0) {
                prefix = 'Te veel betaald';
            }
            else if (item.priceOpen < 0) {
                prefix = 'Terug te krijgen';
            }

            if (!item.isDue) {
                price = `(${Formatter.price(item.priceOpen)})`;
            }
            else {
                price = Formatter.price(item.priceOpen);
            }

            if (item.price === item.amount * item.unitPrice) {
                if (description) {
                    description += `\n`;
                }
                description += `${Formatter.escapeHtml(Formatter.float(item.amount))} x ${Formatter.escapeHtml(Formatter.price(item.unitPrice))}`;
            }
            else {
                if (description) {
                    description += `\n`;
                }
                description += `<span class="email-style-discount-old-price">${Formatter.escapeHtml(Formatter.float(item.amount))} x ${Formatter.escapeHtml(Formatter.price(item.unitPrice))}</span><span class="email-style-discount-price">${Formatter.escapeHtml(Formatter.price(item.price))}</span>`;
            }

            if (item.pricePaid !== 0 && item.pricePaid !== (item.amount * item.unitPrice)) {
                if (description) {
                    description += `\n`;
                }
                description += `Betaald: ${Formatter.price(item.pricePaid)}`;
            }

            if (item.pricePending !== 0) {
                if (description) {
                    description += `\n`;
                }
                description += `In verwerking: ${Formatter.price(item.pricePending)}`;
            }

            str += `<tr><td>${prefix ? `<p class="email-style-title-prefix-list${prefixClass ? ' ' + prefixClass : ''}">${Formatter.escapeHtml(prefix)}</p>` : ''}<h4 class="email-style-title-list">${Formatter.escapeHtml(title)}</h4>${description ? `<p class="email-style-description-small pre-wrap">${description}</p>` : ''}</td><td>${Formatter.escapeHtml(price)}</td></tr>`;
        }

        return str + '</tbody></table>';
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
}

export class BalanceItemWithPrivatePayments extends BalanceItemWithPayments {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentWithPrivatePayment) })
    payments: BalanceItemPaymentWithPrivatePayment[] = [];
}

export class GroupedBalanceItems {
    items: BalanceItem[];

    constructor() {
        this.items = [];
    }

    get id() {
        return this.items[0].groupCode;
    }

    add(item: BalanceItem) {
        this.items.push(item);
    }

    get balanceItem() {
        return this.items[0];
    }

    /**
     * Only shows amount open
     */
    get amount() {
        return this.items.reduce((acc, item) => acc + item.amount, 0);
    }

    get status() {
        return this.balanceItem.status;
    }

    /**
     * Only shows outstanding price
     */
    get priceOpen() {
        return this.items.reduce((acc, item) => acc + item.priceOpen, 0);
    }

    get price() {
        return this.items.reduce((acc, item) => acc + item.price, 0);
    }

    get pricePending() {
        return this.items.reduce((acc, item) => acc + item.pricePending, 0);
    }

    get pricePaid() {
        return this.items.reduce((acc, item) => acc + item.pricePaid, 0);
    }

    get itemTitle() {
        if (this.items.length === 1) {
            // Return normal prefix
            return this.items[0].itemTitle;
        }
        return this.items[0].groupTitle;
    }

    get itemDescription() {
        if (this.items.length === 1) {
            // Return normal prefix
            return this.items[0].itemDescription;
        }
        return this.items[0].groupDescription;
    }

    get unitPrice() {
        return this.items[0].unitPrice;
    }

    get dueAt() {
        return this.items[0].dueAt; ;
    }

    get isDue() {
        return this.items[0].isDue;
    }

    get isOverDue() {
        return this.items[0].isOverDue;
    }

    get type() {
        return this.items[0].type;
    }

    static group(items: BalanceItem[]): GroupedBalanceItems[] {
        const map = new Map<string, GroupedBalanceItems>();

        for (const item of items) {
            const code = item.groupCode;
            if (!map.has(code)) {
                map.set(code, new GroupedBalanceItems());
            }

            map.get(code)!.add(item);
        }

        return Array.from(map.values()).filter(v => v.priceOpen !== 0);
    }
}
