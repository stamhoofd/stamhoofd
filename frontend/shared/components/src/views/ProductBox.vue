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

                <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.location" class="description" v-text="product.location.name" />
                <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.dateRange" class="description" v-text="formatDateRange(product.dateRange)" />
                <p v-else-if="product.description" class="description" v-text="product.description" />

                <p class="price">
                    {{ priceString }}

                    <span v-if="product.enableInFuture" class="style-tag">{{ $t('56954008-cc3d-4460-afaa-f986d1f35d24', {date: product.enableAfter ? formatDateTime(product.enableAfter) : '?'}) }}</span>
                    <span v-else-if="!product.isEnabled && !admin" class="style-tag error">{{ $t('11b3bb72-0edb-401e-9c60-47fbb2d132fc') }}</span>
                    <span v-else-if="product.isSoldOut" class="style-tag error">{{ $t('44ba544c-3db6-4f35-b7d1-b63fdcadd9ab') }}</span>
                    <span v-else-if="stockText !== null" class="style-tag" :class="stockText.style">{{ stockText.text }}</span>
                </p>
            </div>
            <figure v-if="imageSrc">
                <img :src="imageSrc" :width="imgWidth" :height="imgHeight" :alt="product.name">
            </figure>
            <figure v-else>
                <span v-if="product.type === 'Ticket' || product.type === 'Voucher'" class="icon ticket gray" />
                <span class="icon arrow-right-small gray" />
            </figure>
            <hr>
        </div>
    </article>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, useCanDismiss, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CartItemView } from '@stamhoofd/components';
import { Cart, CartItem, CartStockHelper, Checkout, Product, ProductDateRange, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    admin?: boolean;
    product: Product;
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null) => void;
}>(), {
    admin: false,
});

const present = usePresent();
const show = useShow();
const canDismiss = useCanDismiss();
const cart = computed(() => props.checkout.cart);

const priceString = computed(() => {
    const priceRanges = Formatter.uniqueArray(props.product.filteredPrices({ admin: props.admin }).map(p => p.price));
    if (priceRanges.length === 1) {
        if (priceRanges[0] === 0) {
            if (props.webshop.isAllFree) {
                return '';
            }
            return $t(`Gratis`);
        }
        return Formatter.price(priceRanges[0]);
    }
    const minimum = Math.min(...priceRanges);
    const maximum = Math.max(...priceRanges);
    return Formatter.price(minimum, true) + ' - ' + Formatter.price(maximum, true);
});

const count = computed(() => {
    return cart.value.items.reduce((prev, item) => {
        if (item.product.id !== props.product.id) {
            return prev;
        }
        return prev + item.amount;
    }, 0);
});

const imageResolution = computed(() => props.product.images[0]?.getResolutionForSize(100, 100));
const imageSrc = computed(() => imageResolution.value?.file.getPublicPath());
const imgWidth = computed(() => imageResolution.value?.width);
const imgHeight = computed(() => imageResolution.value?.height);

const stockText = computed(() => {
    const remainingWithoutCart = CartStockHelper.getRemainingAcrossOptions({ cart: new Cart(), product: props.product, webshop: props.webshop, admin: props.admin }, { inMultipleCartItems: true, excludeOrder: true });

    if (remainingWithoutCart === 0) {
        return {
            text: $t(`Uitverkocht`),
            style: 'error',
        };
    }

    if (editExisting.value) {
        if (remainingWithoutCart === null || remainingWithoutCart > 25) {
            return null;
        }

        const maxOrder = CartStockHelper.getOrderMaximum({ cart: new Cart(), product: props.product, webshop: props.webshop, admin: props.admin });
        if (maxOrder && maxOrder.remaining !== null && maxOrder.remaining < remainingWithoutCart) {
            // No point in showing stock: you can only order x items in one order
            return null;
        }

        return {
            text: $t(`Nog {count}`, { count: props.product.getRemainingStockText(remainingWithoutCart) }),
            style: 'warn',
        };
    }

    // How much we can still order from this product
    const maxOrder = CartStockHelper.getOrderMaximum({ cart: cart.value, product: props.product, webshop: props.webshop, admin: props.admin });
    const remaining = CartStockHelper.getRemainingAcrossOptions({ cart: cart.value, product: props.product, webshop: props.webshop, admin: props.admin }, { inMultipleCartItems: true, excludeOrder: true });

    if (maxOrder && maxOrder.remaining === 0) {
        return {
            text: $t(`Maximum bereikt`),
            style: 'error',
        };
    }

    if (remaining === null) {
        return null;
    }

    if (remaining > 25 || (maxOrder && maxOrder.remaining !== null && remaining > maxOrder.remaining)) {
        // No point in showing stock: you can only order x items in one order
        return null;
    }

    if (remaining === 0) {
        return {
            text: $t(`Maximum bereikt`),
            style: 'error',
        };
    }

    return {
        text: $t(`Nog {count}`, {count: props.product.getRemainingStockText(remaining)}),
        style: 'warn',
    };
});

const editExisting = computed(() => props.product.isUnique || !props.webshop.shouldEnableCart);

function onClicked() {
    const editExistingValue = editExisting.value;
    const oldItem = editExistingValue ? cart.value.items.find(i => i.product.id === props.product.id) : undefined;

    let cartItem = oldItem?.clone() ?? CartItem.createDefault(props.product, cart.value, props.webshop, { admin: props.admin });

    // refresh: to make sure we display the latest data
    if (oldItem) {
        try {
            cartItem.refresh(props.webshop);
        }
        catch (e) {
            console.error(e);

            // Not recoverable
            cartItem = CartItem.createDefault(props.product, cart.value, props.webshop, { admin: props.admin });
        }
    }

    if (canDismiss.value) {
        show(new ComponentWithProperties(CartItemView, {
            admin: props.admin,
            cartItem,
            oldItem,
            cart: cart.value,
            webshop: props.webshop,
            checkout: props.checkout,
            saveHandler: props.saveHandler,
        })).catch(console.error);
    }
    else {
        present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(CartItemView, {
                        admin: props.admin,
                        cartItem,
                        oldItem,
                        webshop: props.webshop,
                        checkout: props.checkout,
                        saveHandler: props.saveHandler,
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        }).catch(console.error);
    }
}

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
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
