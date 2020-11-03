import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, ObjectData, PartialWithoutMethods } from '@simonbackx/simple-encoding';

import { Option, OptionMenu, Product, ProductPrice } from './Product';

export class CartItemOption extends AutoEncoder {
    @field({ decoder: Option })
    option: Option;

    @field({ decoder: OptionMenu })
    optionMenu: OptionMenu;
}

export class CartItem extends AutoEncoder {

    @field({ decoder: Product })
    product: Product;

    @field({ decoder: ProductPrice })
    productPrice: ProductPrice;
    
    @field({ decoder: new ArrayDecoder(CartItemOption) })
    options: CartItemOption[] = []

    @field({ decoder: IntegerDecoder })
    amount = 1;

    static create<T extends typeof AutoEncoder>(this: T, object: PartialWithoutMethods<CartItem>): InstanceType<T>  {
        const c = super.create(object) as CartItem

        // Fill in all default options here
        for (const optionMenu of c.product.optionMenus) {
            if (optionMenu.multipleChoice) {
                continue;
            }

            if (c.options.find(o => o.optionMenu.id === optionMenu.id)) {
                continue
            }

            c.options.push(CartItemOption.create({
                option: optionMenu.options[0],
                optionMenu: optionMenu
            }))

        }

        return c as InstanceType<T>
    }

    /**
     * Unique identifier to check if two cart items are the same
     */
    get id(): string {
        return this.product.id+"."+this.productPrice.id+"."+this.options.map(o => o.option.id).join(".");
    }

    get unitPrice(): number {
        let price = this.productPrice.price
        for (const option of this.options) {
            price += option.option.price
        }
        return Math.max(0, price)
    }

    get price(): number {
        return this.unitPrice * this.amount
    }

    get description(): string {
        const descriptions: string[] = []
        if (this.product.prices.length > 1) {
            descriptions.push(this.productPrice.name)
        }
        for (const option of this.options) {
            descriptions.push(option.option.name)
        }
        return descriptions.join("\n")
    }

    duplicate(version: number) {
        return CartItem.decode(new ObjectData(this.encode({ version }), { version }))
    }

}

export class Cart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = []

    addItem(item: CartItem) {
        const c = item.id
        for (const i of this.items) {
            if (i.id === c) {
                i.amount += item.amount
                return
            }
        }
        this.items.push(item)
    }

    removeItem(item: CartItem) {
        const c = item.id
        for (const [index, i] of this.items.entries()) {
            if (i.id === c) {
                this.items.splice(index, 1)
                return
            }
        }
    }
}