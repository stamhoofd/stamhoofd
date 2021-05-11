import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Image } from '../files/Image';

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
}

export enum InputFieldType {
    Text = "Text",
    LongText = "LongText",
    Phone = "Phone"
}

export class InputField extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(InputFieldType) })
    type = InputFieldType.Text

    @field({ decoder: StringDecoder })
    title = ""

    @field({ decoder: StringDecoder })
    autocomplete = ""
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

    /**
     * When this option is selected, optionally add one extra input field without a title (title is ignored here)
     */
    @field({ decoder: InputField, version: 91 })
    inputField: InputField | null = null
}

export enum OptionMenuType {
    ChooseOne = "ChooseOne"
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

enum ProductType {
    Product = "Product",
    Ticket = "Ticket"
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

    @field({ decoder: new EnumDecoder(ProductType) })
    type = ProductType.Product
    
    /**
     * Set to true if you need to have a name for every ordered product. When this is true, you can't order this product mutliple times with the same name.
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
