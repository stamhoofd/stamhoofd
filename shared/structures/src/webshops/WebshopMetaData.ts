import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, Data, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, PatchableDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Address } from '../addresses/Address';
import { City } from '../addresses/City';
import { Country, CountryDecoder } from '../addresses/CountryDecoder';
import { Province } from '../addresses/Province';
import { DNSRecord, DNSRecordType } from '../DNSRecord';
import { Image } from '../files/Image';
import { RecordCategory } from '../members/records/RecordCategory';
import { downgradePaymentMethodArrayV150, PaymentMethod, PaymentMethodV150 } from '../PaymentMethod';
import { PermissionsByRole } from '../Permissions';
import { Policy } from '../Policy';
import { TransferSettings } from './TransferSettings';
import { WebshopField } from './WebshopField';

export class WebshopTimeSlot extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    /**
     * Day. The time is ignored, and timezone should be same timezone as the webshop/organization
     */
    @field({ decoder: DateDecoder })
    date: Date

    /**
     * Saved in minutes since midnight
     */
    @field({ decoder: IntegerDecoder })
    startTime: number = 12*60

    /**
     * Saved in minutes since midnight (so can also keep going after midnight to indicate an event that keeps going until e.g. 03:00)
     */
    @field({ decoder: IntegerDecoder })
    endTime: number = 14*60

    @field({ decoder: IntegerDecoder, nullable: true, version: 143 })
    maxOrders: number | null = null

    @field({ decoder: IntegerDecoder, version: 143 })
    usedOrders = 0

    @field({ decoder: IntegerDecoder, nullable: true, version: 143 })
    maxPersons: number | null = null

    @field({ decoder: IntegerDecoder, version: 143 })
    usedPersons = 0

    get remainingOrders(): number | null {
        if (this.maxOrders === null) {
            return null
        }
        return Math.max(0, this.maxOrders - this.usedOrders)
    }

    get remainingPersons(): number | null {
        if (this.maxPersons === null) {
            return null
        }
        return Math.max(0, this.maxPersons - this.usedPersons)
    }

    /**
     * In case maxPersons and maxOrders are used at the same time, try to transform it onto 1 number of remainign 'stock' for this timeslot,
     * which will be visible for customers
     */
    get listedRemainingStock(): number | null {
        const remainingOrders = this.remainingOrders
        const remainingPersons = this.remainingPersons
        if (remainingOrders === null && remainingPersons === null) {
            return null
        }

        if (remainingPersons === null) {
            return remainingOrders
        }

        if (remainingOrders === null) {
            return remainingPersons
        }

        if (remainingPersons === 0 || remainingOrders === 0) {
            return 0
        }

        // If we still have at least one remaining order, the remaining persons always is the number we need to show
        return remainingPersons
    }

    static sort(a: WebshopTimeSlot, b: WebshopTimeSlot){
        const aa = Formatter.dateIso(a.date)+" "+Formatter.minutesPadded(a.startTime)+" "+Formatter.minutesPadded(a.endTime)
        const bb = Formatter.dateIso(b.date)+" "+Formatter.minutesPadded(b.startTime)+" "+Formatter.minutesPadded(b.endTime)
        if (aa < bb) {
            return -1
        }
        if (aa > bb) {
            return 1
        }
        return 0
    }

    toString() {
        return this.dateString()+", "+this.timeRangeString()
    }

    dateString() {
        return Formatter.dateWithDay(this.date)
    }

    dateStringShort() {
        return Formatter.date(this.date)
    }

    timeRangeString() {
        return Formatter.minutes(this.startTime)+" - "+Formatter.minutes(this.endTime)
    }
}

/**
 * Configuration to keep track of available time slots. Can be a fixed number or an infinite amount of time slots
 */
export class WebshopTimeSlots extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(WebshopTimeSlot) })
    timeSlots: WebshopTimeSlot[] = []
}


export enum CheckoutMethodType {
    "OnSite" = "OnSite",
    "Takeout" = "Takeout",
    "Delivery" = "Delivery"
}

export class CheckoutMethodTypeHelper {
    static getName(type: CheckoutMethodType): string {
        switch (type) {
            case CheckoutMethodType.OnSite:
                return "Ter plaatse consumeren"
            case CheckoutMethodType.Takeout:
                return "Afhalen"
            case CheckoutMethodType.Delivery:
                return "Leveren"
        }
    }
}

export class CheckoutMethod extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(CheckoutMethodType) })
    type: CheckoutMethodType

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: WebshopTimeSlots })
    timeSlots: WebshopTimeSlots = WebshopTimeSlots.create({})

    get typeName() {
        return CheckoutMethodTypeHelper.getName(this.type)
    }
}

export class WebshopTakeoutMethod extends CheckoutMethod {
    @field({ decoder: new EnumDecoder(CheckoutMethodType), patchDefaultValue: () => CheckoutMethodType.Takeout }) // patchDefaultVAlue -> to include this value in all patches and make sure we can recognize the type of the patch
    type: CheckoutMethodType.Takeout = CheckoutMethodType.Takeout

    @field({ decoder: Address })
    address: Address
}

/**
 * Choose a location and time to eat / consume the order
 */
export class WebshopOnSiteMethod extends CheckoutMethod {
    // Indicate this field exists for all versions, but the downgrade should get executed
    @field({ decoder: new EnumDecoder(CheckoutMethodType) })
    @field({ 
        decoder: new EnumDecoder(CheckoutMethodType), 
        version: 105, downgrade: () => {
            // Return takeout method for old clients
            return CheckoutMethodType.Takeout
        },
        patchDefaultValue: () => CheckoutMethodType.OnSite 
    }) // patchDefaultVAlue -> to include this value in all patches and make sure we can recognize the type of the patch
    type: CheckoutMethodType.OnSite = CheckoutMethodType.OnSite

    // TODO: transform into an address with coordinates (used by e-tickets)
    @field({ decoder: Address })
    address: Address
}

/**
 * If you want to have some sort of cost (e.g. delivery cost that is variable depending on the cart value)
 */
export class CheckoutMethodPrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price = 0

    /**
     * At what price of the cart the discount price should be used instead.
     * If it is null, the discount price will never get used
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    minimumPrice: number | null = null

    @field({ decoder: IntegerDecoder })
    discountPrice = 0
}

export class WebshopDeliveryMethod extends CheckoutMethod {
    @field({ decoder: new EnumDecoder(CheckoutMethodType), patchDefaultValue: () => CheckoutMethodType.Delivery }) // patchDefaultVAlue -> to include this value in all patches and make sure we can recognize the type of the patch
    type: CheckoutMethodType.Delivery = CheckoutMethodType.Delivery

    @field({ decoder: CheckoutMethodPrice, version: 45 })
    price: CheckoutMethodPrice = CheckoutMethodPrice.create({})

    @field({ decoder: new ArrayDecoder(City), version: 46 })
    cities: City[] = []

    @field({ decoder: new ArrayDecoder(Province), version: 46 })
    provinces: Province[] = []

    @field({ decoder: new ArrayDecoder(CountryDecoder), version: 46 })
    countries: Country[] = [];
}

export type AnyCheckoutMethod = WebshopTakeoutMethod | WebshopDeliveryMethod | WebshopOnSiteMethod
export type AnyCheckoutMethodPatch = AutoEncoderPatchType<WebshopTakeoutMethod> | AutoEncoderPatchType<WebshopDeliveryMethod> | AutoEncoderPatchType<WebshopOnSiteMethod>

export class AnyCheckoutMethodPatchDecoder {
    static decode(data: Data): AnyCheckoutMethodPatch {
        const base = data.decode(CheckoutMethod.patchType() as Decoder<AutoEncoderPatchType<CheckoutMethod>>)
        if (base.type == CheckoutMethodType.Takeout) {
            return WebshopTakeoutMethod.patchType().decode(data)
        }

        if (base.type == CheckoutMethodType.Delivery) {
            return WebshopDeliveryMethod.patchType().decode(data)
        }

        if (base.type == CheckoutMethodType.OnSite) {
            return WebshopOnSiteMethod.patchType().decode(data)
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unsupported checkout type in patch. Make sure checkout type is always set when patching.",
            field: data.addToCurrentField("type")
        })
    }

    static patchType(): PatchableDecoder<AnyCheckoutMethodPatchDecoder> {
        // We never allow patches on this type
        return AnyCheckoutMethodPatchDecoder
    }

}

export class AnyCheckoutMethodDecoder {
    static decode(data: Data): AnyCheckoutMethod {
        const base = data.decode(CheckoutMethod as Decoder<CheckoutMethod>)
        if (base.type == CheckoutMethodType.Takeout) {
            return WebshopTakeoutMethod.decode(data)
        }

        if (base.type == CheckoutMethodType.Delivery) {
            return WebshopDeliveryMethod.decode(data)
        }

        if (base.type == CheckoutMethodType.OnSite) {
            return WebshopOnSiteMethod.decode(data)
        }

        throw new SimpleError({
            code: "invalid_field",
            message: "Unsupported checkout type",
            field: data.addToCurrentField("type")
        })
    }

    static patchType(): PatchableDecoder<AnyCheckoutMethodPatch> {
        // We never allow patches on this type
        return AnyCheckoutMethodPatchDecoder
    }

    static patchIdentifier(): Decoder<string> {
        // We never allow patches on this type
        return StringDecoder
    }
}

export enum WebshopTicketType {
    "None" = "None",

    /**
     * Create a single ticket for every order. Used to scan the order on takeout
     */
    "SingleTicket" = "SingleTicket",

    /**
     * Create a single ticket for every product in an order
     * + this disables the use of checkout methods
     * + this enables the use of locations and times on products
     */
    "Tickets" = "Tickets"
}

export enum WebshopStatus {
    "Open" = "Open",
    "Closed" = "Closed",
    "Archived" = "Archived"
}

export class WebshopMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    title = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new EnumDecoder(WebshopTicketType), version: 105 })
    ticketType = WebshopTicketType.None

    @field({ decoder: Image, nullable: true })
    coverPhoto: Image | null = null

    @field({ decoder: BooleanDecoder, version: 94 })
    allowComments = false

    @field({ decoder: BooleanDecoder, optional: true })
    phoneEnabled = true

    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), optional: true })
    recordCategories: RecordCategory[] = []

    @field({ decoder: new ArrayDecoder(WebshopField), version: 94 })
    customFields: WebshopField[] = []

    @field({ decoder: new ArrayDecoder(AnyCheckoutMethodDecoder) })
    checkoutMethods: CheckoutMethod[] = []

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethodV150)), version: 41 })
    @field({ 
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), 
        version: 151, 
        downgrade: downgradePaymentMethodArrayV150
    })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Transfer]

    @field({ decoder: new ArrayDecoder(Policy), version: 116 })
    policies: Policy[] = []

    @field({ decoder: StringDecoder, nullable: true, version: 42, field: "iban" })
    @field({ 
        decoder: TransferSettings, 
        version: 49, 
        upgrade: (iban: string | null) => {
            return TransferSettings.create({
                iban
            })
        },
        downgrade: (transferSettings: TransferSettings) => {
            return transferSettings.iban
        } 
    })
    transferSettings = TransferSettings.create({})

    @field({ decoder: DateDecoder, nullable: true, version: 43 })
    availableUntil: Date | null = null

    /**
     * Manually close a webshop
     */
    @field({ decoder: new EnumDecoder(WebshopStatus), version: 136 })
    status = WebshopStatus.Open

    /**
     * Whether the domain name has been validated and is active. Only used to know if this domain should get used emails and in the dashboard.
     * This is to prevent invalid url's from being used in emails.
     * Lookups for a given domain still work if not active
     */
    @field({ decoder: BooleanDecoder, version: 135 })
    domainActive = false

    get hasTickets() {
        return this.ticketType === WebshopTicketType.SingleTicket || this.ticketType === WebshopTicketType.Tickets
    }

    get hasSingleTickets() {
        return this.ticketType === WebshopTicketType.SingleTicket
    }
}

export class WebshopPrivateMetaData extends AutoEncoder {
    /**
     * Automatically has full access
     */
    @field({ decoder: StringDecoder, version: 59 })
    authorId = ""

    @field({ decoder: PermissionsByRole, version: 60, optional: true })
    permissions = PermissionsByRole.create({})

    /**
     * DNS records that need to be set in order to activate mail domain and registration domain
     */
    @field({ decoder: new ArrayDecoder(DNSRecord), version: 135 })
    dnsRecords: DNSRecord[] = [];

    @field({ decoder: StringDecoder, nullable: true, version: 145 })
    defaultEmailId: string | null = null

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 163 })
    notificationEmails: string[] = []

    static buildDNSRecords(domain: string): DNSRecord[] {
        return [
            DNSRecord.create({
                type: DNSRecordType.CNAME,
                name: domain+".",
                value: "domains.stamhoofd.shop."
            })
        ]
    }
}

export class WebshopServerMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    placeholder = ""
}