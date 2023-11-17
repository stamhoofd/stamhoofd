import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { Checkout, Version } from '@stamhoofd/structures'

import { WebshopManager } from './WebshopManager'

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManagerStatic {
    private _checkout: Checkout | null = null

    saveCart() {
        console.log('saving cart', this.cart);
        this.saveCheckout()
    }

    get checkout() {
        if (!this._checkout) {
            this._checkout = this.loadCheckout()
        }
        return this._checkout
    }

    get cart() {
        return this.checkout.cart
    }

    loadCheckout() {
        try {
            const json = localStorage.getItem(WebshopManager.webshop.id+"-checkout")
            if (json) {
                const obj = JSON.parse(json)
                const versionBox = new VersionBoxDecoder(Checkout as Decoder<Checkout>).decode(new ObjectData(obj, { version: Version }))
                return versionBox.data
            }
        } catch (e) {
            console.error("Failed to load cart")
            console.error(e)
        }
        return new Checkout()
    }

    saveCheckout() {
        try {
            console.log('saving checkout', this.checkout);
            this.checkout.update(WebshopManager.webshop)
            const data = new VersionBox(this.checkout).encode({ version: Version })
            const json = JSON.stringify(data)
            console.log('saving checkout', json);
            localStorage.setItem(WebshopManager.webshop.id+"-checkout", json)
        } catch (e) {
            console.error("Failed to save cart")
            console.error(e)
        }
    }
}

export const CheckoutManager = new CheckoutManagerStatic()