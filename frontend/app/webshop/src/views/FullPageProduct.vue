<template>
    <div class="full-product-box">
        <CartItemView :cart-item="cartItem" :checkout="checkout" :save-handler="mappedSaveHandler" :webshop="webshop" :old-item="oldItem" :admin="admin" />
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartItemView } from "@stamhoofd/components";
import { Cart, CartItem, Checkout, Product, Webshop } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        CartItemView
    }
})
export default class FullPageProduct extends Mixins(NavigationMixin){
    @Prop({ default: false })
        admin: boolean

    @Prop({ required: true })
        product: Product
    
    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        checkout: Checkout

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null, component) => void

    cartItem: CartItem | null = null

    get cart() {
        return this.checkout.cart
    }

    created() {
        // Validate the cart item once
        if (!this.oldItem && !this.webshop.shouldEnableCart) {
            // Otherwie we are not able to remove the invalid items
            this.cart.clear()
        }
        this.cartItem = this.getCartItem()
    }

    get updateItem() {
        return !this.webshop.shouldEnableCart || this.product.isUnique
    }

    getCartItem() {
        if (this.oldItem) {
            return this.oldItem.clone()
        }
        
        return CartItem.createDefault(this.product, this.cart, this.webshop, {admin: this.admin})
    }

    get oldItem() {
        if (this.updateItem) {
            const item = this.cart.items.find(i => i.product.id == this.product.id)
            if (item) {
                try {
                    item.validate(this.webshop, this.cart, {
                        refresh: true,
                        admin: this.admin
                    })

                    return item
                } catch (e) {
                    console.error(e)
                }
            }
        }

        return null;
    }

    mappedSaveHandler(newItem: CartItem, oldItem: CartItem | null, component) {
        this.saveHandler(newItem, oldItem, component.canDismiss ? component : null) // no component dismiss

        // Clear the cart item if needed
        this.cartItem = this.getCartItem()
    }
}
</script>