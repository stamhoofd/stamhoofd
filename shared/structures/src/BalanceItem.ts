import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Formatter, Sorter, STMath } from '@stamhoofd/utility';
import { Payment, PrivatePayment } from './members/Payment.js';
import { PriceBreakdown } from './PriceBreakdown.js';
import { TranslatedString } from './TranslatedString.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';

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

export enum VATExcemptReason {
    /**
     * Btw verlegd: Art. 39 bis – intracommunautaire levering
     */
    IntraCommunity = 'IntraCommunity',
}

export function getVATExcemptReasonName(reason: VATExcemptReason): string {
    switch (reason) {
        case VATExcemptReason.IntraCommunity: return $t('c250f8f3-b32a-42bf-8b91-85600115e811');
    }
}

export enum BalanceItemType {
    Registration = 'Registration',
    AdministrationFee = 'AdministrationFee',
    FreeContribution = 'FreeContribution',
    Order = 'Order',
    Other = 'Other',
    PlatformMembership = 'PlatformMembership',
    CancellationFee = 'CancellationFee',
    RegistrationBundleDiscount = 'RegistrationBundleDiscount',
    /**
     * Small differences that occurred when creating a payment or invoice
     */
    Rounding = 'Rounding',
}

export function getBalanceItemStatusName(type: BalanceItemStatus): string {
    switch (type) {
        case BalanceItemStatus.Hidden: return $t(`6276d07c-bd0d-4117-b46c-e3f7b0dbb1e5`);
        case BalanceItemStatus.Due: return $t(`444e0d53-5c4b-4fae-afa6-c5e14224e6e7`);
        case BalanceItemStatus.Canceled: return $t(`72fece9f-e932-4463-9c2b-6e8b22a98f15`);
    }
}

export function getBalanceItemTypeName(type: BalanceItemType): string {
    switch (type) {
        case BalanceItemType.Registration: return $t(`1957d902-4a2a-4b9b-bc5c-83145a5731f7`);
        case BalanceItemType.AdministrationFee: return $t(`be98be36-f796-4f96-b054-4d2a09be3d79`);
        case BalanceItemType.FreeContribution: return $t(`16ca0372-9c8f-49f0-938d-aee012e59f8c`);
        case BalanceItemType.Order: return $t(`41066a52-1fe1-41e9-8292-2b1f376fcc65`);
        case BalanceItemType.Other: return $t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`);
        case BalanceItemType.PlatformMembership: return $t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`);
        case BalanceItemType.CancellationFee: return $t(`ac2be546-732b-4c1a-ace3-c9076795afa0`);
        case BalanceItemType.RegistrationBundleDiscount: return $t(`472a987d-498d-46b0-b925-3963f729492b`);
        case BalanceItemType.Rounding: return $t('5841f72b-67d8-4add-8cfa-801bcb71cba7');
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
        case BalanceItemType.RegistrationBundleDiscount: return 'label';
        case BalanceItemType.Rounding: return 'calculator';
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
    Discount = 'Discount', // Name and id of the related discount
}

export function getBalanceItemRelationTypeName(type: BalanceItemRelationType): string {
    switch (type) {
        case BalanceItemRelationType.Webshop: return $t(`e38c0b49-b038-4c9c-9653-fe1e4a078226`);
        case BalanceItemRelationType.Group: return $t(`1957d902-4a2a-4b9b-bc5c-83145a5731f7`);
        case BalanceItemRelationType.GroupPrice: return $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`);
        case BalanceItemRelationType.GroupOptionMenu: return $t(`792ebf47-4ad3-4d9c-a4ab-f315b715e70e`);
        case BalanceItemRelationType.GroupOption: return $t(`6c80efa8-5658-4728-ba95-d0536fdd25bd`);
        case BalanceItemRelationType.Member: return $t(`f4052a0b-9564-49c4-a6b6-41af3411f3b0`);
        case BalanceItemRelationType.MembershipType: return 'Aansluitingstype';
        case BalanceItemRelationType.Discount: return $t(`40939025-cebb-4afb-90e9-847233cb256f`);
    }
}

export function getBalanceItemRelationTypeDescription(type: BalanceItemRelationType): string {
    switch (type) {
        case BalanceItemRelationType.Webshop: return $t(`efe60194-1a71-45d2-9e12-f6965c266306`);
        case BalanceItemRelationType.Group: return $t(`869faa9e-f446-4500-83e8-93684eac259d`);
        case BalanceItemRelationType.GroupPrice: return $t(`5287b557-b8ed-4580-af63-8b69f1b8c120`);
        case BalanceItemRelationType.GroupOptionMenu: return $t(`12f6ad95-f1e2-4065-b8fb-369186bf0f91`);
        case BalanceItemRelationType.GroupOption: return $t(`c18b4ad6-4b29-43bf-bb6d-7e3c34ffe80a`);
        case BalanceItemRelationType.Member: return $t(`15cd9dab-e1d5-4f02-b260-bd587ba3cf1e`);
        case BalanceItemRelationType.MembershipType: return 'Naam van het aansluitingstype geassocieerd aan dit item';
        case BalanceItemRelationType.Discount: return $t(`4d5cd18a-ad96-4b2b-aa91-80af307cb8cd`);
    }
}

/**
 * Return true if it is allowed to group balance items if they have a different value for this relation type
 */
export function shouldAggregateOnRelationType(type: BalanceItemRelationType, item: { type: BalanceItemType; relations: Map<BalanceItemRelationType, BalanceItemRelation> }): boolean {
    switch (type) {
        case BalanceItemRelationType.Group: {
            if (item.type === BalanceItemType.RegistrationBundleDiscount) {
                // Aggregate across all groups
                return true;
            }
            return false;
        }
        case BalanceItemRelationType.GroupPrice:
            // Only aggregate on group price if it is not for a specific option (we'll combine all options in one group, regardless of the corresponding groupPrice)
            return !item.relations.has(BalanceItemRelationType.GroupOption);
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
    @field(TranslatedString.field({ version: 372 }))
    name = new TranslatedString();
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

    /**
     * quantity, should be renamed to quantity in the future
     */
    @field({ decoder: IntegerDecoder, version: 307 })
    amount = 1;

    get quantity() {
        return this.amount;
    }

    set quantity(value: number) {
        this.amount = value;
    }

    /**
     * Price per piece
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @field({ decoder: IntegerDecoder, field: 'price' })
    @field({ decoder: IntegerDecoder, field: 'unitPrice', version: 307 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    unitPrice = 0; // unit price

    @field({ decoder: IntegerDecoder, nullable: true, version: 390 })
    VATPercentage: number | null = null;

    @field({ decoder: BooleanDecoder, version: 390 })
    VATIncluded = true;

    /**
     * Whether there is a VAT excempt reason.
     * Note: keep the original VAT in these cases. On time of payment or invoicing, the VAT excemption will be revalidated.
     * If that fails, we can still charge the VAT.
     */
    @field({ decoder: new EnumDecoder(VATExcemptReason), nullable: true, version: 390 })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * @deprecated use priceWithVAT in combination with isDue
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    get price() {
        if (this.status === BalanceItemStatus.Hidden || this.status === BalanceItemStatus.Canceled) {
            return 0;
        }
        return this.priceWithVAT;
    }

    /**
     * Total price that needs to be paid, not including already paid or pending payments.
     *
     * The difference with priceWithVAT is that it takes into account canceled and hidden balance items
     */
    get payablePriceWithVAT() {
        if (this.status === BalanceItemStatus.Hidden || this.status === BalanceItemStatus.Canceled) {
            return 0;
        }
        return this.priceWithVAT;
    }

    /**
     * Difference here is that when the VAT is excempt, this is still set, while VAT will be zero.
     */
    get calculatedVAT() {
        if (!this.VATPercentage) {
            // VAT percentage not set, so treat as 0%
            return 0;
        }

        if (this.VATIncluded) {
            // Calculate VAT on price incl. VAT, which is not 100% correct and causes roudning issues
            return this.unitPrice * this.amount - STMath.round(this.unitPrice * this.amount * 100 / (100 + this.VATPercentage));
        }

        // Note: the rounding is only to avoid floating point errors in software, this should not cause any actual rounding
        // That is the reason why we store it up to 4 digits after comma
        return STMath.round(this.VATPercentage * this.unitPrice * this.amount / 100);
    }

    /**
     * Note, this is not 100% accurate.
     * Legally we most often need to calculate the VAT on invoice level and round it there.
     * Technically we cannot pass infinite accurate numbers around in a system to avoid rounding. The returned number is
     * therefore rounded up to 4 digits after the comma. On normal amounts, with only 2 digits after the comma, this won't lose accuracy.
     * So the VAT calculation needs to happen at the end again before payment.
     */
    get VAT() {
        if (this.VATExcempt) {
            // Exempt from VAT
            return 0;
        }

        return this.calculatedVAT;
    }

    get priceWithVAT() {
        return this.priceWithoutVAT + this.VAT;
    }

    /**
     * Note: when the VAT is already included, the result of this will be unreliable because of rounding issues.
     * Do not use this in calculations!
     */
    get priceWithoutVAT() {
        if (this.VATIncluded) {
            return this.unitPrice * this.amount - this.calculatedVAT;
        }

        return this.unitPrice * this.amount;
    }

    get unitPriceWithVAT() {
        if (this.amount === 0) {
            return 0;
        }
        return STMath.round(this.priceWithVAT / this.amount);
    }

    /**
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    get priceOpen() {
        if (this.status !== BalanceItemStatus.Due) {
            return -this.pricePaid - this.pricePending;
        }
        return this.priceWithVAT - this.pricePaid - this.pricePending;
    }

    /**
     * Cached value, for optimizations
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    pricePaid = 0;

    /**
     * Cached value, for optimizations
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @field({ decoder: IntegerDecoder, version: 335 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    pricePending = 0;

    /**
     * How much has been invoiced
     */
    // @field({ decoder: IntegerDecoder, ... NextVersion })
    // priceInvoiced = 0;

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
        return this.pricePaid === this.priceWithVAT;
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
        const totalPrice = items.map(p => p.priceWithVAT).reduce((t, total) => total + t, 0);
        const payablePriceWithVAT = items.map(p => p.payablePriceWithVAT).reduce((t, total) => total + t, 0);
        const totalOpen = items.map(p => p.priceOpen).reduce((t, total) => total + t, 0);

        return {
            priceWithVAT: totalPrice,
            payablePriceWithVAT,
            pricePending: totalPending,
            priceOpen: totalOpen,
            pricePaid: totalPaid,
        };
    }

    static filterBalanceItems(items: BalanceItem[]) {
        return items.filter(i => i.priceOpen !== 0).sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.dueAt ?? new Date(0), a.dueAt ?? new Date(0)),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
    }

    get paymentShortDescription(): string {
        // This doesn't list individual options
        switch (this.type) {
            case BalanceItemType.Registration: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                const group = this.relations.get(BalanceItemRelationType.Group)?.name.toString() || $t(`0a54d0a3-e963-447a-81ac-6982a7508649`);

                if (option) {
                    return $t(`973d141e-441d-41b8-ad43-06f71c10126f`) + ' ' + group;
                }

                return $t(`7a6a379d-97fb-4874-bdcf-48be82a76087`) + ' ' + group;
            }

            case BalanceItemType.RegistrationBundleDiscount: {
                const discount = this.relations.get(BalanceItemRelationType.Discount);
                return discount?.name?.toString() || getBalanceItemTypeName(BalanceItemType.RegistrationBundleDiscount);
            }

            case BalanceItemType.CancellationFee: {
                const option = this.relations.get(BalanceItemRelationType.GroupOption);
                const group = this.relations.get(BalanceItemRelationType.Group)?.name.toString();

                if (group) {
                    if (option) {
                        return $t(`bfa4c1b3-9613-49c1-ad3d-360f533a4086`) + ' ' + group;
                    }

                    return $t(`f94551a3-b971-44d8-9c92-4686653d118b`) + ' ' + group;
                }
                return $t(`156e42fb-1e0b-4bfc-b8bf-9bcc76b2b895`);
            }
            case BalanceItemType.AdministrationFee: return $t(`13fbbe0e-5326-4cc8-928e-5fc50b27654a`);
            case BalanceItemType.FreeContribution: return $t(`1a36fef2-0e2f-4dca-b661-7274ef63dbb5`);
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name.toString() || $t(`b05702b7-72bc-4dbd-8197-cf758442dc5f`);
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return $t(`03df4cd8-446f-4f40-8d27-90a51bb5a6ba`) + ' ' + this.relations.get(BalanceItemRelationType.MembershipType)?.name || $t(`ab4ad0cf-53df-4f35-96a8-59747075417f`);
            case BalanceItemType.Rounding: return this.description;
        }
    }

    /**
     * To help split payments in categories: return a more detailed category than purely the type
     */
    get category(): string {
        switch (this.type) {
            case BalanceItemType.Registration: {
                return this.relations.get(BalanceItemRelationType.Group)?.name.toString() ?? $t(`9fb913bf-ebc1-48aa-885e-73f24b8da239`);
            }
            case BalanceItemType.RegistrationBundleDiscount: {
                const discount = this.relations.get(BalanceItemRelationType.Discount);
                return discount?.name.toString() || getBalanceItemTypeName(BalanceItemType.RegistrationBundleDiscount);
            }
            case BalanceItemType.CancellationFee: return this.relations.get(BalanceItemRelationType.Group)?.name.toString() ?? this.relations.get(BalanceItemRelationType.Webshop)?.name.toString() ?? this.relations.get(BalanceItemRelationType.MembershipType)?.name.toString() ?? $t(`77828342-0662-4a7c-846b-e4fb4ae91553`);
            case BalanceItemType.AdministrationFee: return $t(`13fbbe0e-5326-4cc8-928e-5fc50b27654a`);
            case BalanceItemType.FreeContribution: return $t(`1a36fef2-0e2f-4dca-b661-7274ef63dbb5`);
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name.toString() ?? $t(`b05702b7-72bc-4dbd-8197-cf758442dc5f`);
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return this.relations.get(BalanceItemRelationType.MembershipType)?.name.toString() ?? $t(`5026a42a-66ad-4cc1-9400-c7c1407bc7c0`);
            case BalanceItemType.Rounding: return $t('097441a3-6b49-4768-87c3-8b290bb073ed');
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
                    const group = this.relations.get(BalanceItemRelationType.Group)?.name || $t(`0a54d0a3-e963-447a-81ac-6982a7508649`);
                    return $t(`ab7efbf3-6dff-4237-93ba-4ac34f75765b`) + ' ' + group;
                }
                break;
            }
            case BalanceItemType.CancellationFee: {
                const list: string[] = [];
                // List all relations
                for (const [key, value] of this.relations.entries()) {
                    if (shouldAggregateOnRelationType(key, this)) {
                        list.push(getBalanceItemRelationTypeName(key) + ': ' + value.name.toString());
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
                name: $t(`057ffcea-70b1-44a9-ad01-c60f6fbd7393`),
                price: this.pricePaid,
            },
            {
                name: $t(`ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8`),
                price: this.pricePending,
            },
        ].filter(a => a.price !== 0);

        if (this.VATPercentage) {
            // Add VAT
            all.unshift({
                name: $t(`14ad1dfb-6ab9-4945-8735-7e22526120c9`),
                price: this.priceWithoutVAT,
            }, {
                name: $t(`31e38bb6-60be-47b7-a713-7f430b7d08c4`),
                price: this.VAT,
            },
            {
                name: $t(`39e5d1d1-7058-4ba0-a477-df2c7707b531`),
                price: this.priceWithVAT,
            });
        }
        else if (all.length > 0) {
            all.unshift({
                name: $t(`8dfbd01b-feb1-4b7e-a1f1-2daf19fb2775`),
                price: this.priceWithVAT,
            });
        }

        return [
            ...all,
            {
                name: this.priceOpen < 0 ? $t(`c59769e0-b0fa-42f3-b713-82a2d7237a9c`) : $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
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
                + '-vat-percentage-' + this.VATPercentage
                + '-vat-included-' + this.VATIncluded
                + '-vat-excempt-' + this.VATExcempt
                + '-description-' + this.description
                + '-due-date-' + (this.dueAt ? Formatter.dateIso(this.dueAt) : 'null');
        }

        return 'type-' + this.type
            + '-' + this.status
            + '-unit-price-' + this.unitPrice
            + '-vat-percentage-' + this.VATPercentage
            + '-vat-included-' + this.VATIncluded
            + '-vat-excempt-' + this.VATExcempt
            + '-due-date-' + (this.dueAt ? Formatter.dateIso(this.dueAt) : 'null')
            + '-relations' + Array.from(this.relations.entries())
            .filter(([key]) => !shouldAggregateOnRelationType(key, this))
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
                    return (optionMenu?.name ?? $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`)) + ': ' + option.name;
                }
                const group = this.relations.get(BalanceItemRelationType.Group)?.name || $t(`0a54d0a3-e963-447a-81ac-6982a7508649`);
                const price = this.relations.get(BalanceItemRelationType.GroupPrice)?.name.toString();
                return $t(`d07f7f84-0d5d-43fd-a7df-f58ca0f3245d`) + ' ' + group + (price && price !== 'Standaardtarief' ? ' (' + price + ')' : '');
            }
            case BalanceItemType.RegistrationBundleDiscount: {
                const discount = this.relations.get(BalanceItemRelationType.Discount);

                if (this.price > 0) {
                    // Undo the discount
                    return $t('766a39be-a4af-4a04-baf0-1f064d2fed16') + ' (' + (discount?.name.toString() || getBalanceItemTypeName(BalanceItemType.RegistrationBundleDiscount)) + ')';
                }
                return discount?.name.toString() || getBalanceItemTypeName(BalanceItemType.RegistrationBundleDiscount);
            }
            case BalanceItemType.CancellationFee: return $t(`ac2be546-732b-4c1a-ace3-c9076795afa0`);
            case BalanceItemType.AdministrationFee: return $t(`be98be36-f796-4f96-b054-4d2a09be3d79`);
            case BalanceItemType.FreeContribution: return $t(`16ca0372-9c8f-49f0-938d-aee012e59f8c`);
            case BalanceItemType.Order: return this.relations.get(BalanceItemRelationType.Webshop)?.name.toString() || $t(`8ce0947e-8681-4abd-b8ef-27d0218fa4a1`);
            case BalanceItemType.Other: return this.description;
            case BalanceItemType.PlatformMembership: return $t(`0495e7f0-10bf-4cd9-8d93-1a8b62ce19aa`) + ' ' + this.relations.get(BalanceItemRelationType.MembershipType)?.name.toString() || $t(`25589636-c28d-4c5b-9b5c-0f1cfd4037ef`);
            case BalanceItemType.Rounding: return $t(`e50caf1a-fe3d-4b35-8b69-eee76406ecbc`);
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
                    const group = this.relations.get(BalanceItemRelationType.Group)?.name.toString() || $t(`0a54d0a3-e963-447a-81ac-6982a7508649`);
                    prefix = $t(`ab7efbf3-6dff-4237-93ba-4ac34f75765b`) + ' ' + group;
                }
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return (prefix ? (prefix + '\n') : '') + member.name;
                }
                return prefix;
            }
            case BalanceItemType.RegistrationBundleDiscount: {
                const descriptions: string[] = [];
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    descriptions.push(member.name.toString());
                }
                const group = this.relations.get(BalanceItemRelationType.Group);
                if (group) {
                    descriptions.push($t(`d07f7f84-0d5d-43fd-a7df-f58ca0f3245d`) + ' ' + group.name);
                }
                return descriptions.join('\n');
            }
            case BalanceItemType.PlatformMembership: {
                const member = this.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return member.name.toString();
                }
                break;
            }
            case BalanceItemType.CancellationFee: {
                const list: string[] = [];
                // List all relations
                for (const [key, value] of this.relations.entries()) {
                    list.push(getBalanceItemRelationTypeName(key) + ': ' + value.name.toString());
                }
                return list.join('\n');
            }
            case BalanceItemType.Rounding: {
                const list: string[] = [];
                // List all relations
                for (const [key, value] of this.relations.entries()) {
                    list.push(getBalanceItemRelationTypeName(key) + ': ' + value.name.toString());
                }
                return list.join('\n');
            }
        }
        return null;
    }

    static getDetailsHTMLTable(items: BalanceItem[]): string {
        const grouped = GroupedBalanceItems.group(BalanceItem.filterBalanceItems(items));

        if (grouped.length === 0) {
            return '<p class="description">' + $t('4c4f6571-f7b5-469d-a16f-b1547b43a610') + '</p>';
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
                prefix = $t(`72fece9f-e932-4463-9c2b-6e8b22a98f15`);
                prefixClass = 'error';
            }
            else if (item.priceOpen < 0 && item.pricePaid > item.price && item.pricePaid > 0) {
                prefix = $t(`0c39a71f-be73-4404-8af0-cd9f238d2060`);
            }
            else if (item.priceOpen < 0) {
                prefix = $t(`bdf22906-037e-4221-8d3e-113bc62da28e`);
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
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
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
        return this.items.reduce((acc, item) => acc + item.payablePriceWithVAT, 0);
    }

    get unitPriceWithVAT() {
        return this.items.reduce((acc, item) => acc + item.unitPriceWithVAT, 0);
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

    get unitPriceWithAT() {
        return this.items[0].unitPriceWithVAT;
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
