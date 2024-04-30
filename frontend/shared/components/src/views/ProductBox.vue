<template>
    <article class="product-box" :class="{ selected: count > 0}" @click="onClicked">
        <div class="left" />
        <div class="content">
            <div>
                <h3>
                    <div class="counter">
                        {{ count }} x
                    </div>
                    {{ product.name }}
                </h3>

                <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.location" class="description" v-text="product.location.name" />
                <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.dateRange" class="description" v-text="formatDateRange(product.dateRange)" />
                <p v-else-if="product.description" class="description" v-text="product.description" />

                <p class="price">
                    {{ priceString }}

                    <span v-if="product.enableInFuture" class="style-tag">Vanaf {{ formatDateTime(product.enableAfter) }}</span>
                    <span v-else-if="!product.isEnabled && !admin" class="style-tag error">Onbeschikbaar</span>
                    <span v-else-if="product.isSoldOut" class="style-tag error">Uitverkocht</span>
                    <span v-else-if="stockText !== null" class="style-tag" :class="stockText.style">{{ stockText.text }}</span>
                </p>
            </div>
            <figure v-if="imageSrc">
                <img :src="imageSrc" :width="imgWidth" :height="imgHeight" :alt="product.name">
            </figure>
            <figure v-else>
                <span v-if="product.type == 'Ticket' || product.type == 'Voucher'" class="icon ticket gray" />
                <span class="icon arrow-right-small gray" />
            </figure>
            <hr>
        </div>
    </article>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartItemView, Checkbox, LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Cart, CartItem, CartStockHelper, Checkout, Product, ProductDateRange, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        dateTime: (d: Date) => Formatter.dateTime(d, true)
    }
})
export default class ProductBox extends Mixins(NavigationMixin){
    @Prop({ default: false })
        admin: boolean

    @Prop({ required: true })
        product: Product
    
    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        checkout: Checkout

    @Prop({ required: true })
        saveHandler: (newItem: CartItem, oldItem: CartItem | null) => void

    get price() {
        return this.product.prices[0].price
    }

    get cart() {
        return this.checkout.cart
    }

    get priceString() {
        const priceRanges = Formatter.uniqueArray(this.product.filteredPrices({admin: this.admin}).map(p => p.price))
        if (priceRanges.length == 1) {
            if (priceRanges[0] === 0) {
                if (this.webshop.isAllFree) {
                    return "";
                }
                return "Gratis"
            }
            return Formatter.price(priceRanges[0])
        }
        const minimum = Math.min(...priceRanges)
        const maximum = Math.max(...priceRanges)
        return Formatter.price(minimum, true) + " - " + Formatter.price(maximum, true)
    }

    get count() {
        return this.cart.items.reduce((prev, item) => {
            if (item.product.id != this.product.id) {
                return prev
            }
            return prev + item.amount
        }, 0)
    }

    get pendingReservationCount() {
        return this.cart.items.reduce((prev, item) => {
            if (item.product.id != this.product.id) {
                return prev
            }
            return prev + item.amount - item.reservedAmount
        }, 0)
    }

    get imageResolution() {
        return this.product.images[0]?.getResolutionForSize(100, 100)
    }
    
    get imageSrc() {
        return this.imageResolution?.file.getPublicPath()
    }

    get imgWidth() {
        return this.imageResolution?.width
    }

    get imgHeight() {
        return this.imageResolution?.height
    }

    get stockText() {
        const remainingWithoutCart = CartStockHelper.getRemainingAcrossOptions({ cart: new Cart(), product: this.product, webshop: this.webshop, admin: this.admin}, {inMultipleCartItems: true, excludeOrder: true});

        if (remainingWithoutCart === 0) {
            return {
                text: "Uitverkocht",
                style: "error"
            }
        }

        if (this.editExisting) {
            if (remainingWithoutCart === null || remainingWithoutCart > 25) {
                return null
            }

            const maxOrder = CartStockHelper.getOrderMaximum({ cart: new Cart(), product: this.product, webshop: this.webshop, admin: this.admin});
            if (maxOrder && maxOrder.remaining !== null && maxOrder.remaining < remainingWithoutCart) {
                // No point in showing stock: you can only order x items in one order
                return null;
            }

            return {
                text:  'Nog ' + this.product.getRemainingStockText(remainingWithoutCart),
                style: "warn"
            }
        }


        // How much we can still order from this product
        const maxOrder = CartStockHelper.getOrderMaximum({ cart: this.cart, product: this.product, webshop: this.webshop, admin: this.admin});
        const remaining = CartStockHelper.getRemainingAcrossOptions({ cart: this.cart, product: this.product, webshop: this.webshop, admin: this.admin}, {inMultipleCartItems: true, excludeOrder: true});

        if (maxOrder && maxOrder.remaining === 0) {
            return {
                text: "Maximum bereikt",
                style: "error"
            }
        }
        
        if (remaining === null) {
            return null
        }

        if (remaining > 25 || (maxOrder && maxOrder.remaining !== null && remaining > maxOrder.remaining)) {
            // No point in showing stock: you can only order x items in one order
            return null
        }
    
        if (remaining === 0 ) {
            return {
                text: "Maximum bereikt",
                style: "error"
            }
        }

        return {
            text:  'Nog ' + this.product.getRemainingStockText(remaining),
            style: "warn"
        }
    }

    get editExisting() {
        return this.product.isUnique || !this.webshop.shouldEnableCart
    }

    onClicked() {
        const editExisting = this.editExisting
        const oldItem = editExisting ? this.cart.items.find(i => i.product.id == this.product.id) : undefined

        let cartItem = oldItem?.clone() ?? CartItem.createDefault(this.product, this.cart, this.webshop, {admin: this.admin})

        // refresh: to make sure we display the latest data
        if (oldItem) {
            try {
                cartItem.refresh(this.webshop)
            } catch (e) {
                console.error(e)

                // Not recoverable
                cartItem = CartItem.createDefault(this.product, this.cart, this.webshop, {admin: this.admin})
            }
        }

        if (this.canDismiss) {
            this.show(new ComponentWithProperties(CartItemView, { 
                admin: this.admin,
                cartItem,
                oldItem,
                cart: this.cart,
                webshop: this.webshop,
                checkout: this.checkout,
                saveHandler: this.saveHandler,
            }))
        } else {
            this.present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(CartItemView, { 
                            admin: this.admin,
                            cartItem,
                            oldItem,
                            webshop: this.webshop,
                            checkout: this.checkout,
                            saveHandler: this.saveHandler,
                        })
                    })
                ],
                modalDisplayStyle: "sheet"
            });
        }
    }

    formatDateRange(dateRange: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(dateRange.toString())
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.product-box {
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
    transition: background-color 0.2s 0.1s;

    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    padding-right: var(--st-horizontal-padding, 15px);

    .maskingSvg {
        display: none;
    }

    > .content > hr {
        border: 0;
        outline: 0;
        height: $border-width;
        background: $color-border;
        border-radius: calc($border-width / 2);
        margin: 0;
        position: absolute;
        bottom: 0;
        left: 0;
        right: calc(-1 * var(--st-horizontal-padding, 15px));
    }

    &:last-child {
        > .content > hr {
            display: none;
        }
    }

    &:active {
        transition: none;
        background: $color-primary-background;
    }

    > .left {
        overflow: hidden;
        width: 4px;
        flex-shrink: 0;
        background: $color-primary;
        align-self: stretch;
        border-radius: $border-radius;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity 0.2s, transform 0.2s;
        margin-right: var(--st-horizontal-padding, 15px);
    }

    &.selected {
        > .left {
            opacity: 1;
            transform: translateX(0);
        }
    }

    > .content {
        flex-grow: 1;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        position: relative;

        > div {
            padding: 15px 0;

            flex-grow: 1;
            min-width: 0;

            > h3 {
                padding-top: 5px;
                @extend .style-title-3;
                line-height: 1.3;
                padding-right: 30px;
                position: relative;
                transition: transform 0.2s;

                > .counter {
                    position: absolute;
                    left: 0;
                    opacity: 0;
                    width: 30px;

                    font-size: 14px;
                    line-height: 1.4;
                    font-weight: 600;
                    color: $color-primary;

                    transform: translateX(-30px);
                    transition: opacity 0.2s;
                    white-space: nowrap;
                }
            }

            > .description {
                @extend .style-description-small;
                padding-top: 5px;
                text-overflow: ellipsis;
                overflow: hidden;
                display: -webkit-box;
                white-space: pre-wrap;
                line-clamp: 2; /* number of lines to show */
                -webkit-line-clamp: 2; /* number of lines to show */
                -webkit-box-orient: vertical;

                + .description {
                    padding-top: 0;
                }
            }

            > .price {
                font-size: 14px;
                line-height: 1.4;
                font-weight: 600;
                padding-top: 10px;
                color: $color-primary;
                display: flex;
                flex-direction: row;

                .style-tag {
                    margin-left: auto;
                }
            }
        }
        
    }

    &.ticket {
        position: relative;
    }


    &.selected {
        > .content > div {
            > h3 {
                transform: translateX(30px);

                >.counter {
                    opacity: 1;
                }
            }
        }
    }

    figure {
        flex-shrink: 0;
        padding: 15px 0 15px 15px;

        img {
            //width: auto; // breaks layout shift on load
            height: auto;
            max-width: 70px;
            // max-height: 70px; // breaks aspect ratio
            border-radius: $border-radius;
            display: block;

            @media (min-width: 340px) {
                max-width: 80px;
                // max-height: 80px; // breaks aspect ratio
            }
        }
    }
}

.enable-grid .product-box {
    @media (min-width: 801px) {
        background: $color-background;
        border-radius: $border-radius;
        margin: 0;
        
        box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.05), 0px 20px 50px $color-shadow, inset 0px 0px 0px 1px $color-shadow;
        overflow: hidden;

        padding-right: 0;

        &:active {
            transition: none;
            background: $color-primary-background;
        }

        > .content > hr {
            display: none;
        }

        > .left {
            margin-right: 0;
        }

        > .content > div {
            padding: 15px;
        }

        figure {
            padding: 15px 15px 15px 15px;

            img {
                // width: auto; // breaks layout shift on load
                height: auto;
                max-width: 100px;
                // max-height: 100px; // breaks aspect ratio
            }
        }

        &.ticket {
            overflow: visible;

            .maskingSvg {
                display: block;
                z-index: -1;
                position: absolute;
                height: 100%;
                width: 100%;
            }
            
            background: none;

            // Force hardware acceleration (for filter)
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            position: relative;
            z-index: 1;

            filter: drop-shadow($color-shadow 0px 20px 50px) drop-shadow(rgba(0, 0, 0, 0.05) 0px 4px 4px);
            box-shadow: none;

            > .left {
                order: 30;
                transform: translateX(4px);
            }

            &.selected > .left {
                transform: translateX(0px);
            }

            > .content > div {
                padding-left: 30px;
                padding-top: 30px;
                padding-bottom: 30px;
            }

            .svg-background {
                transition: fill 0.2s 0.1s;
                fill: $color-background;
            }

            &:active {
                background: none;

                .svg-background {
                    transition: none;
                    fill: $color-primary-background;
                }
            }
        }
    }
}

</style>