import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { Checkout, DiscountCode, Version } from '@stamhoofd/structures'

import { WebshopManager } from './WebshopManager'
import { Toast } from '@stamhoofd/components'

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManagerStatic {
    private _checkout: Checkout | null = null

    saveCart() {
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

    async validateCodes() {
        try {
            // Validate code
            const response = await WebshopManager.server.request({
                method: "POST",
                path: "/webshop/"+WebshopManager.webshop.id + '/discount-codes',
                body: this.checkout.discountCodes.map(c => c.code),
                decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>)
            })

            this.checkout.discountCodes = response.data;
            this.checkout.update(WebshopManager.webshop)
            this.saveCheckout()

        } catch (e) {
            // ignore
        }
    }

    async applyCode(code: string) {
        const toast = new Toast('Kortingscode toepassen', 'spinner').setHide(null).show();

        try {
            // Validate code
            const response = await WebshopManager.server.request({
                method: "POST",
                path: "/webshop/"+WebshopManager.webshop.id + '/discount-codes',
                body: [...this.checkout.discountCodes.map(c => c.code), code],
                decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>)
            })

            this.checkout.discountCodes = response.data;
            this.checkout.update(WebshopManager.webshop)
            this.saveCheckout()

            if (this.checkout.discountCodes.find(c => c.code === code)) {
                new Toast('Kortingscode toegepast', 'success primary').setHide(null).show();
            } else {
                new Toast('Ongeldige kortingscode '+code, 'red error').setHide(null).show();
            }
            
        } finally {
            toast.hide();
        }
    }

    removeCode(discountCode: DiscountCode) {
        this.checkout.discountCodes = this.checkout.discountCodes.filter(c => c.id !== discountCode.id)
        this.checkout.update(WebshopManager.webshop)
        this.saveCheckout()
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
            this.checkout.update(WebshopManager.webshop)
            const data = new VersionBox(this.checkout).encode({ version: Version })
            const json = JSON.stringify(data)
            localStorage.setItem(WebshopManager.webshop.id+"-checkout", json)
        } catch (e) {
            console.error("Failed to save cart")
            console.error(e)
        }
    }

    clear() {
        this.cart.clear()
        this.checkout.discountCodes = [];
        this.saveCheckout()
    }
}

export const CheckoutManager = new CheckoutManagerStatic()