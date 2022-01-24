<template>
    <article class="product-box" :class="{ selected: count > 0, ticket: (product.type == 'Ticket' || product.type == 'Voucher')}" @click="onClicked">
        <svg width="100%" height="100%" class="maskingSvg">
            <defs>
                <mask :id="'ProductBoxMask-'+product.id">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" rx="5px" />
                    <circle cx="0" cy="50%" r="15px" fill="black" />
                </mask>
            </defs>

            <rect x="0" y="0" width="100%" height="100%" fill="white" :mask="'url(#ProductBoxMask-'+product.id+')'" class="svg-background" />
        </svg>

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
                    {{ price | priceFree }}

                    <span v-if="!product.enabled" class="style-tag error">Tijdelijk onbeschikbaar</span>
                    <span v-else-if="product.isSoldOut" class="style-tag error">Uitverkocht</span>
                    <span v-else-if="product.stockText !== null" class="style-tag warn">{{ product.stockText }}</span>
                </p>
            </div>
            <figure v-if="imageSrc">
                <img :src="imageSrc">
            </figure>
            <figure v-else>
                <span class="icon arrow-right-small gray" />
            </figure>
            <hr>
        </div>
    </article>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CartItemView, Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { Cart, CartItem, Product, ProductDateRange, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
        price: Formatter.price,
        priceFree: (p: number) => {
            if (p === 0) {
                return "Gratis"
            }
            return Formatter.price(p);
        }
    }
})
export default class ProductBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    product: Product
    
    @Prop({ required: true })
    webshop: Webshop

    @Prop({ required: true })
    cart: Cart

    @Prop({ required: true })
    saveHandler: (newItem: CartItem, oldItem: CartItem | null) => void

    get price() {
        return this.product.prices[0].price
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
    
    get imageSrc() {
        return this.product.images[0]?.getPathForSize(100, 100)
    }

    onClicked() {
        if (!this.product.enabled) {
            new Toast("Dit artikel is jammer genoeg tijdelijk onbeschikbaar", "error red").show()
            return;
        }

        if (this.product.isSoldOut) {
            new Toast("Dit artikel is jammer genoeg uitverkocht", "error red").show()
            return;
        }

        if (this.product.remainingStock != null && this.product.remainingStock <= this.pendingReservationCount) {
            new Toast("Je hebt het maximaal aantal stuks bereikt dat je nog kan bestellen van dit artikel.", "error red").show()
            return;
        }

        const cartItem = CartItem.create({
            product: this.product,
            productPrice: this.product.prices[0]
        })

        if (this.canDismiss) {
            this.show(new ComponentWithProperties(CartItemView, { 
                cartItem,
                cart: this.cart,
                webshop: this.webshop,
                saveHandler: this.saveHandler,
            }))
        } else {
            this.present(new ComponentWithProperties(CartItemView, { 
                cartItem,
                cart: this.cart,
                webshop: this.webshop,
                saveHandler: this.saveHandler,
            }).setDisplayStyle("sheet"))
        }
    }

    get remainingStock() {
        return this.product.remainingStock
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
            width: 70px;
            height: 70px;
            border-radius: $border-radius;
            display: block;

            @media (min-width: 340px) {
                width: 80px;
                height: 80px;
            }
        }
    }
}

.enable-grid .product-box {
    @media (min-width: 801px) {
        background: $color-background;
        border-radius: $border-radius;
        margin: 0;
        @include style-side-view-shadow();
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
                width: 100px;
                height: 100px;
            }
        }

        &.ticket {
            .maskingSvg {
                display: block;
                z-index: -1;
                position: absolute;
            }
            
            background: none;
            filter: drop-shadow($color-side-view-shadow 0px 2px 5px);
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