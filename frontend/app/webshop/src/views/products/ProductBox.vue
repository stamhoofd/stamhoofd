<template>
    <article class="product-box" :class="{selected: count > 0}" @click="onClicked">
        <div class="left" />
        <div class="content">
            <div>
                <h3>
                    <div class="counter">
                        {{ count }} x
                    </div>
                    {{ product.name }}
                </h3>
                <p v-if="product.description" class="description" v-text="product.description" />
                <p class="price">
                    {{ price | price }}

                    <span class="style-tag" v-if="product.isSoldOut">Uitverkocht</span>
                </p>
            </div>
            <hr>
        </div>
        <figure v-if="imageSrc">
            <img :src="imageSrc">
        </figure>
    </article>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { CartItem, Product } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from '../../classes/CheckoutManager';
import CartItemView from './CartItemView.vue';

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
        price: Formatter.price
    }
})
export default class ProductBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    product: Product
    CheckoutManager = CheckoutManager

    get price() {
        return this.product.prices[0].price
    }

    get count() {
        return CheckoutManager.cart.items.reduce((prev, item) => {
            if (item.product.id != this.product.id) {
                return prev
            }
            return prev + item.amount
        }, 0)
    }
    
    get imageSrc() {
        return this.product.images[0]?.getPathForSize(100, 100)
    }

    onClicked() {
        if (this.product.isSoldOut) {
            new Toast("Dit artikel is jammer genoeg uitverkocht", "error red").show()
            return;
        }

        if (this.product.remainingStock != null && this.product.remainingStock <= this.count) {
            new Toast("Je hebt het maximaal aantal stuks bereikt dat je nog kan bestellen van dit artikel.", "error red").show()
            return;
        }

        const cartItem = CartItem.create({
            product: this.product,
            productPrice: this.product.prices[0]
        })

        this.present(new ComponentWithProperties(CartItemView, { cartItem }).setDisplayStyle("sheet"))
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
    overflow: hidden;

    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
    transition: background-color 0.2s 0.1s;

    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

    > .content > hr {
        border: 0;
        outline: 0;
        height: $border-width;
        width: 100%;
        background: var(--color-current-border, #{$color-border});
        border-radius: $border-width/2;
        margin: 0;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
    }

    &:last-child {
        > .content > hr {
            display: none;
        }
    }

    @media (min-width: 801px) {
        background: $color-white;
        border-radius: $border-radius;
        margin: 0;
        @include style-side-view-shadow();

        > .content > hr {
            display: none;
        }
    }

    &:active {
        transition: none;
        background: $color-background-shade;
        background: var(--color-current-background-shade, $color-background-shade);
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
            padding: 15px;
            padding-left: var(--st-horizontal-padding, 15px);
            padding-right: var(--st-horizontal-padding, 15px);

            @media (min-width: 801px) {
                padding: 15px;
            }

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

    > figure {
        flex-shrink: 0;
        padding: 15px 15px 15px 0;

        img {
            width: 70px;
            height: 70px;
            border-radius: $border-radius;

            @media (min-width: 340px) {
                width: 80px;
                height: 80px;
            }

            @media (min-width: 801px) {
                width: 100px;
                height: 100px;
            }
        }
    }
}
</style>