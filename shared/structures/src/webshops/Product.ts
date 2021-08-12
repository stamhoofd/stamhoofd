import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Address } from '../addresses/Address';
import { Image } from '../files/Image';
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
    address: Address

    // todo: coordinates here (only filled in by backend)
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

    @field({ decoder: new ArrayDecoder(Image) })
    images: Image[] = []

    @field({ decoder: new ArrayDecoder(WebshopField), version: 94 })
    customFields: WebshopField[] = []

    @field({ decoder: new EnumDecoder(ProductType) })
    type = ProductType.Product

    @field({ decoder: ProductLocation, nullable: true, version: 105 })
    location: ProductLocation | null = null

    @field({ decoder: ProductDateRange, nullable: true, version: 105 })
    time: ProductDateRange | null = null
    
    /**
     * WIP: not yet supported
     * Set to true if you need to have a name for every ordered product. When this is true, you can't order this product mutliple times with the same name.
     * + will validate the name better
     */
    @field({ decoder: BooleanDecoder })
    askName = false

    /**
     * For now, we keep the stock stored with the product. But keep in mind that we'll move this to a different more performant place in the future.
     * We'll combine writes to the same product to reduce database writes for every order.
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    stock: number | null = null

    /**
     * Only increased when stock is not null.
     */
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
}
