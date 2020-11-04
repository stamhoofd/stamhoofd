import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { Cart, Checkout, Version } from '@stamhoofd/structures'

import { WebshopManager } from './WebshopManager'

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManagerStatic {
    private _cart: Cart | null = null
    private _checkout: Checkout | null = null

    get cart() {
        if (!this._cart) {
            this._cart = this.loadCart()
        }
        return this._cart
    }

    loadCart() {
        const json = localStorage.getItem(WebshopManager.webshop.id+"-cart")
        if (json) {
            try {
                const obj = JSON.parse(json)
                const versionBox = new VersionBoxDecoder(Cart as Decoder<Cart>).decode(new ObjectData(obj, { version: Version }))
                return versionBox.data

            } catch (e) {
                console.error("Failed to load cart")
                console.error(e)
            }
        }
        return new Cart()
    }

    saveCart() {
        const data = new VersionBox(this.cart).encode({ version: Version })
        const json = JSON.stringify(data)
        localStorage.setItem(WebshopManager.webshop.id+"-cart", json)
    }

    get checkout() {
        if (!this._checkout) {
            this._checkout = this.loadCheckout()
        }
        return this._checkout
    }

    loadCheckout() {
        const json = localStorage.getItem(WebshopManager.webshop.id+"-checkout")
        if (json) {
            try {
                const obj = JSON.parse(json)
                const versionBox = new VersionBoxDecoder(Checkout as Decoder<Checkout>).decode(new ObjectData(obj, { version: Version }))
                return versionBox.data

            } catch (e) {
                console.error("Failed to load cart")
                console.error(e)
            }
        }
        return new Checkout()
    }

    saveCheckout() {
        const data = new VersionBox(this.checkout).encode({ version: Version })
        const json = JSON.stringify(data)
        localStorage.setItem(WebshopManager.webshop.id+"-checkout", json)
    }
}

export const CheckoutManager = new CheckoutManagerStatic()