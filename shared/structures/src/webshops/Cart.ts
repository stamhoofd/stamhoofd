import { ArrayDecoder, AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

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
}