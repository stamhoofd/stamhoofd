import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Address } from '../addresses/Address';
import { Image } from '../files/Image';
import { ReservedSeat } from '../SeatingPlan';
import { WebshopField } from './WebshopField';

export class ProductPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = "";
    
    /**
     * Price is always in cents, to avoid floating point errors
     */
    @field({ decoder: IntegerDecoder })
    price = 0;

    // Optional: different price if you reach a given amount of pieces (options and prices shouldn't be the same)
    @field({ decoder: IntegerDecoder, nullable: true, version: 93 })
    discountPrice: number | null = null;

    // Only used if discountPrice is not null
    @field({ decoder: IntegerDecoder, version: 93 })
    discountAmount = 2
}

export class Option extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    /**
     * Price added (can be negative) is always in cents, to avoid floating point errors
     */
    @field({ decoder: IntegerDecoder })
    price = 0;
}

export class OptionMenu extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: BooleanDecoder })
    multipleChoice = false;

    @field({ decoder: new ArrayDecoder(Option) })
    options: Option[] = [
        Option.create({})
    ]
}

export enum ProductType {
    Product = "Product",
    Person = "Person",
    Ticket = "Ticket",
    Voucher = "Voucher"
}

/**
 * This includes a location for a ticket (will be visible on the ticket)
 */
export class ProductLocation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: Address })
    @field({ decoder: Address, nullable: true, version: 146, downgrade: (v) => {
        if (!v) {
            return Address.createDefault()
        }
        return v
    } })
    address: Address | null = null

    // TODO: coordinates here (only filled in by backend)
}

/**
 * This includes a time for a ticket (will be visible on the ticket)
 */
export class ProductDateRange extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder })
    startDate = new Date()

    @field({ decoder: DateDecoder })
    endDate = new Date()

    toString() {
        if (Formatter.dateIso(this.startDate) === Formatter.dateIso(this.endDate)) {
            return Formatter.dateWithDay(this.startDate)+", "+Formatter.time(this.startDate)+" - "+Formatter.time(this.endDate)
        }
        
        // If start in evening and end on the next morning: only mention date once
        if (Formatter.dateIso(this.startDate) === Formatter.dateIso(new Date(this.endDate.getTime() - 24*60*60*1000)) && Formatter.timeIso(this.endDate) <= "12:00" && Formatter.timeIso(this.startDate) >= "12:00") {
            return Formatter.dateWithDay(this.startDate)+", "+Formatter.time(this.startDate)+" - "+Formatter.time(this.endDate)
        }

        return Formatter.dateTime(this.startDate)+" - "+Formatter.dateTime(this.endDate)

    }
}

export class Product extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: BooleanDecoder })
    enabled = true

    @field({ decoder: BooleanDecoder, version: 172 })
    hidden = false

    /**
     * Allow to order multiple pieces of the same product combination
     */
    @field({ decoder: BooleanDecoder, version: 173 })
    allowMultiple = true

    /**
     * Only allow one piece per product combination
     */
    @field({ decoder: BooleanDecoder, version: 173 })
    unique = false

    @field({ decoder: DateDecoder, nullable: true, version: 172 })
    enableAfter: Date | null = null

    @field({ decoder: DateDecoder, nullable: true, version: 172 })
    disableAfter: Date | null = null

    get isEnabled() {
        return this.enabled && !this.hidden && (!this.enableAfter || this.enableAfter <= new Date()) && (!this.disableAfter || this.disableAfter >= new Date())
    }

    get enableInFuture() {
        return this.enabled && !this.hidden && this.enableAfter !== null && this.enableAfter > new Date() && (!this.disableAfter || this.disableAfter >= new Date())
    }

    get isTicket() {
        return this.type === ProductType.Ticket || this.type === ProductType.Voucher
    }

    @field({ decoder: new ArrayDecoder(Image) })
    images: Image[] = []

    @field({ decoder: new ArrayDecoder(WebshopField), version: 94 })
    customFields: WebshopField[] = []

    @field({ decoder: new EnumDecoder(ProductType) })
    type = ProductType.Product

    @field({ decoder: ProductLocation, nullable: true, version: 105 })
    location: ProductLocation | null = null

    @field({ decoder: ProductDateRange, nullable: true, version: 105 })
    dateRange: ProductDateRange | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 211 })
    seatingPlanId: string|null = null
    
    @field({ decoder: new ArrayDecoder(ReservedSeat), nullable: true, version: 211 })
    reservedSeats: ReservedSeat[] = []

    /**
     * WIP: not yet supported
     * Set to true if you need to have a name for every ordered product. When this is true, you can't order this product mutliple times with the same name.
     * + will validate the name better
     */
    @field({ decoder: BooleanDecoder, optional: true })
    askName = false

    /**
     * Maximum amount per order
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 171 })
    maxPerOrder: number | null = null

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    stock: number | null = null

    @field({ decoder: IntegerDecoder })
    usedStock = 0

    /**
     * All the prices of this product (e.g. small, medium, large), should contain at least one price.
     */
    @field({
        decoder: new ArrayDecoder(ProductPrice), 
        defaultValue: () => [
            ProductPrice.create({
                name: "", 
                price: 0
            })
        ]
    })
    prices: ProductPrice[];

    @field({ decoder: new ArrayDecoder(OptionMenu) })
    optionMenus: OptionMenu[] = []

    clearStock() {
        this.usedStock = 0
    }

    get isSoldOut(): boolean {
        if (this.stock === null) {
            return false
        }
        return this.usedStock >= this.stock
    }

    get remainingStock(): number | null {
        if (this.stock === null) {
            return null
        }
        return Math.max(0, this.stock - this.usedStock)
    }

    /**
     * Whether it is not possibel to add multiple different items of this product to the cart, or whether this product supports multiple items in the cart.
     * Controls whether cart is edited by default or updated when clicking it open in the webshop.
     */
    get isUnique() {
        if (this.maxPerOrder === 1) {
            return true
        }

        // No choice options
        if (this.optionMenus.length === 0 && this.prices.length <= 1 && this.customFields.length === 0) {
            return true
        }

        return false;
    }

    getRemainingStockText(stock: number): string {
        if (stock === 1) {
            if (this.type === ProductType.Ticket) {
                return "één ticket"
            }
            if (this.type === ProductType.Person) {
                return "één persoon"
            }
            return "één stuk"
        }

        if (this.type === ProductType.Ticket) {
            return stock+" tickets"
        }

        if (this.type === ProductType.Person) {
            return stock+" personen"
        }
        return stock+" stuks"
    }

    get stockText(): string | null {
        if (this.remainingStock === null || this.remainingStock > 25) {
            return null
        }

        if (this.remainingStock === 0) {
            return "Uitverkocht"
        }

        return "Nog "+this.getRemainingStockText(this.remainingStock)
    }

    get isEnabledTextLong() {
        if (this.hidden) {
            return 'Verborgen'
        }

        if (!this.enabled) {
            return 'Onbeschikbaar'
        }

        if (this.enableInFuture && this.enableAfter) {
            if (this.disableAfter) {
                return "Beschikbaar vanaf "+Formatter.dateTime(this.enableAfter) + " tot "+Formatter.dateTime(this.disableAfter)
            }
            return "Beschikbaar vanaf "+Formatter.dateTime(this.enableAfter)
        }

        if (!this.isEnabled) {
            return 'Onbeschikbaar'
        }
        
        if (this.disableAfter) {
            return "Beschikbaar tot "+Formatter.dateTime(this.disableAfter)
        }
    }

    get closesSoonText(): string | null {
        if (!this.isEnabled) {
            return null
        }

        if (this.disableAfter) {
            const diff = this.disableAfter.getTime() - new Date().getTime()
            if (diff < 24*60*60*1000) {
                return "Beschikbaar tot "+Formatter.time(this.disableAfter)
            }
        }
        return null
    }
}
