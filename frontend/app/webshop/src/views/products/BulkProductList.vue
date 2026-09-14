<template>
    <div class="bulk-product-list">
        <div v-for="(group, groupIndex) of groups" :key="group.id" class="container">
            <hr v-if="groupIndex > 0">
            <h2 v-if="group.name" class="larger">
                {{ group.name }}
            </h2>
            <p v-if="group.description" class="style-description-small" v-text="group.description" />

            <div class="boxed">
                <STList>
                    <STListItem v-for="product of group.products" :key="product.id" data-testid="bulk-product-row" :class="{ 'amount-focused': getPrices(product).length === 1 && focusedAmountKey === amountKey(product, getPrices(product)[0]) }" :selectable="isCheckboxRow(product) && canOrder(product)" :element-name="isCheckboxRow(product) ? 'label' : 'article'">
                        <h3 class="style-title-list bolder">
                            {{ product.name }}
                            <button v-if="product.description || product.images.length > 0" class="button icon info-circle gray inline" type="button" data-testid="bulk-product-info" @click.stop.prevent="showProductInfo(product)" />
                        </h3>
                        <p v-if="getProductDescription(product)" class="style-description-small">
                            {{ getProductDescription(product) }}
                        </p>

                        <div v-if="getStockTag(product)" class="tags-without-background">
                            <p class="style-tag small" :class="getStockTag(product)!.style">
                                <span v-if="getStockTag(product)!.style === 'warn'" class="icon lightning text-size" />
                                <span>{{ getStockTag(product)!.text }}</span>
                            </p>
                        </div>

                        <p v-for="error of getErrors(product)" :key="error" class="error-box small">
                            {{ error }}
                        </p>

                        <div v-if="getPrices(product).length > 1" class="stacked-box">
                            <STList>
                                <STListItem v-for="price of getPrices(product)" :key="price.id" class="no-border" :class="{ 'amount-focused': focusedAmountKey === amountKey(product, price) }" :selectable="!product.allowMultiple && canOrder(product)" :element-name="!product.allowMultiple ? 'label' : 'article'">
                                    <template v-if="!product.allowMultiple" #left>
                                        <Radio :model-value="getSelectedPriceId(product)" :value="price.id" :name="product.id + '-price'" :disabled="!canOrder(product)" @update:model-value="selectPrice(product, price)" />
                                    </template>
                                    <h4 class="style-title-list">
                                        {{ price.name || $t('%CL') }}
                                    </h4>
                                    <p class="style-description-small">
                                        {{ formatPriceName(price) }}
                                    </p>
                                    <PriceInputBox v-if="price.allowCustomPrice && getAmount(product, price) > 0" :model-value="getCustomPrice(product, price)" class="max custom-price-box" :min="ProductPrice.customPriceMinimum" :max="ProductPrice.customPriceMaximum" :validator="null" data-testid="custom-price-input" @update:model-value="setCustomPrice(product, price, $event)" />
                                    <template v-if="product.allowMultiple" #right>
                                        <input class="amount-input" type="text" inputmode="numeric" :value="getAmount(product, price) || ''" placeholder="0" data-testid="bulk-amount" @focus="focusedAmountKey = amountKey(product, price)" @blur="focusedAmountKey = null" @change="onAmountInput(product, price, $event)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()">
                                        <StepperInput :model-value="getAmount(product, price)" :min="0" :max="getMaximum(product, price)" data-testid="bulk-stepper" @update:model-value="setAmount(product, price, $event)" />
                                    </template>
                                </STListItem>
                            </STList>
                        </div>

                        <PriceInputBox v-else-if="getPrices(product)[0]?.allowCustomPrice && getAmount(product, getPrices(product)[0]) > 0" :model-value="getCustomPrice(product, getPrices(product)[0])" class="max custom-price-box" :min="ProductPrice.customPriceMinimum" :max="ProductPrice.customPriceMaximum" :validator="null" data-testid="custom-price-input" @update:model-value="setCustomPrice(product, getPrices(product)[0], $event)" />

                        <template v-if="getPrices(product).length === 1" #right>
                            <input v-if="product.allowMultiple" class="amount-input" type="text" inputmode="numeric" :value="getAmount(product, getPrices(product)[0]) || ''" placeholder="0" data-testid="bulk-amount" @focus="focusedAmountKey = amountKey(product, getPrices(product)[0])" @blur="focusedAmountKey = null" @change="onAmountInput(product, getPrices(product)[0], $event)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()">
                            <StepperInput v-if="product.allowMultiple" :model-value="getAmount(product, getPrices(product)[0])" :min="0" :max="getMaximum(product, getPrices(product)[0])" data-testid="bulk-stepper" @update:model-value="setAmount(product, getPrices(product)[0], $event)" />
                            <Checkbox v-else :model-value="getAmount(product, getPrices(product)[0]) > 0" :disabled="!canOrder(product)" data-testid="bulk-checkbox" @update:model-value="setAmount(product, getPrices(product)[0], $event ? 1 : 0)" />
                        </template>
                        <template v-else-if="!product.allowMultiple && getSelectedPriceId(product)" #right>
                            <button class="button icon trash gray" type="button" data-testid="bulk-clear-product" @click="clearProduct(product)" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import StepperInput from '@stamhoofd/components/inputs/StepperInput.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { getProductStockTag } from '@stamhoofd/components/views/productStockTag.ts';
import type { Product } from '@stamhoofd/structures';
import { Cart, CartItem, CartStockHelper, ProductPrice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { getProductListTitle } from '../../classes/webshopWording';
import { useWebshopManager } from '../../composables/useWebshopManager';

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const webshop = computed(() => webshopManager.webshop);
const cart = computed(() => checkoutManager.cart);

const visibleProducts = computed(() => webshop.value.products.filter(p => !p.hidden));

const groups = computed(() => {
    const categorised = new Set<string>();
    const groups = webshop.value.categories.flatMap((category) => {
        const products = category.productIds.flatMap((id) => {
            const product = visibleProducts.value.find(p => p.id === id);
            if (!product) {
                return [];
            }
            categorised.add(product.id);
            return [product];
        });
        if (products.length === 0) {
            return [];
        }
        return [{ id: category.id, name: category.name, description: category.description, products }];
    });

    const rest = visibleProducts.value.filter(p => !categorised.has(p.id));
    if (rest.length > 0) {
        groups.push({ id: 'uncategorised', name: groups.length > 0 ? $t('Andere') : getProductListTitle(webshop.value), description: '', products: rest });
    }
    return groups;
});

function getPrices(product: Product) {
    return product.filteredPrices({ admin: false });
}

/**
 * Non-multiple product with one price: the whole row toggles the checkbox
 */
function isCheckboxProduct(product: Product) {
    return !product.allowMultiple && getPrices(product).length === 1;
}

/**
 * The row itself is the label of the checkbox, unless a price input can appear in it (a label may only wrap one control)
 */
function isCheckboxRow(product: Product) {
    return isCheckboxProduct(product) && !getPrices(product)[0].allowCustomPrice;
}

function getProductDescription(product: Product) {
    const parts: string[] = [];
    if (product.dateRange) {
        parts.push(Formatter.capitalizeFirstLetter(product.dateRange.toString()));
    }
    if (product.location) {
        parts.push(product.location.name);
    }
    const prices = getPrices(product);
    if (prices.length === 1 && !prices[0].allowCustomPrice && prices[0].price > 0) {
        parts.push(Formatter.price(prices[0].price));
    }
    if (parts.length === 0 && product.description) {
        return product.description;
    }
    return parts.join(' • ');
}

function formatPriceName(price: ProductPrice) {
    if (price.allowCustomPrice) {
        return $t('Kies zelf een bedrag');
    }
    return Formatter.price(price.price);
}

function getItems(product: Product, price: ProductPrice) {
    return cart.value.items.filter(i => i.product.id === product.id && i.productPrice.id === price.id);
}

function getAmount(product: Product, price: ProductPrice) {
    return getItems(product, price).length;
}

function getSelectedPriceId(product: Product) {
    return cart.value.items.find(i => i.product.id === product.id)?.productPrice.id ?? '';
}

function getStockTag(product: Product) {
    return getProductStockTag({ product, webshop: webshop.value, cart: cart.value, admin: false, editExisting: false });
}

function canOrder(product: Product) {
    return product.isEnabled && !product.isSoldOut;
}

function getErrors(product: Product) {
    return Formatter.uniqueArray(cart.value.items.filter(i => i.product.id === product.id && i.cartError).map(i => i.cartError!.getHuman()));
}

/**
 * How many units of this price can be in the cart, given the other items
 */
function getMaximum(product: Product, price: ProductPrice): number | null {
    if (!canOrder(product)) {
        return 0;
    }
    const otherItems = cart.value.items.filter(i => !(i.product.id === product.id && i.productPrice.id === price.id));
    const otherCart = Cart.create({ items: otherItems });
    const probe = CartItem.create({ product, productPrice: price, amount: 1 });
    const remaining = probe.getMaximumRemaining(null, otherCart, webshop.value, false);
    const orderMaximum = CartStockHelper.getOrderMaximum({ product, cart: otherCart, webshop: webshop.value, admin: false });
    if (orderMaximum?.remaining !== null && orderMaximum?.remaining !== undefined) {
        return remaining === null ? orderMaximum.remaining : Math.min(remaining, orderMaximum.remaining);
    }
    return remaining;
}

const present = usePresent();

function showProductInfo(product: Product) {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./ProductInfoView.vue'), { product }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

const focusedAmountKey = ref<string | null>(null);

function amountKey(product: Product, price: ProductPrice) {
    return product.id + '-' + price.id;
}

/**
 * Typed amount: digits only, clamped to what can still be ordered. The field is re-synced because Vue
 * only rewrites the DOM value when the amount actually changed.
 */
function onAmountInput(product: Product, price: ProductPrice, event: Event) {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value.replace(/\D/g, ''), 10);
    let amount = isNaN(parsed) ? 0 : parsed;
    const max = getMaximum(product, price);
    if (max !== null && amount > max) {
        amount = max;
        Toast.warning($t(`%zD`)).show();
    }
    setAmount(product, price, amount);
    input.value = amount ? amount.toString() : '';
}

function createItem(product: Product, price: ProductPrice) {
    // Clone: a custom price is stored on the cart item, never on the webshop. New units reuse the price the visitor already entered.
    const existing = getItems(product, price)[0];
    return CartItem.create({ product, productPrice: existing ? existing.productPrice.clone() : price.clone(), amount: 1 });
}

function setAmount(product: Product, price: ProductPrice, amount: number) {
    const items = getItems(product, price);
    if (amount > items.length) {
        for (let i = items.length; i < amount; i++) {
            cart.value.addItem(createItem(product, price), false);
        }
    } else if (amount < items.length) {
        const remove = new Set(items.slice(amount).map(i => i.id));
        cart.value.items = cart.value.items.filter(i => !remove.has(i.id));
    }
    checkoutManager.saveCart();
}

function selectPrice(product: Product, price: ProductPrice) {
    // Non-multiple product: at most one unit in the cart
    cart.value.items = cart.value.items.filter(i => i.product.id !== product.id);
    cart.value.addItem(createItem(product, price), false);
    checkoutManager.saveCart();
}

function clearProduct(product: Product) {
    cart.value.items = cart.value.items.filter(i => i.product.id !== product.id);
    checkoutManager.saveCart();
}

function getCustomPrice(product: Product, price: ProductPrice) {
    return getItems(product, price)[0]?.productPrice.price ?? price.price;
}

function setCustomPrice(product: Product, price: ProductPrice, value: number | null) {
    if (value === null) {
        return;
    }
    for (const item of getItems(product, price)) {
        item.productPrice.price = value;
    }
    checkoutManager.saveCart();
}

onMounted(() => {
    // One product with one price: preselect a unit so the visitor can continue right away
    if (cart.value.items.length > 0 || visibleProducts.value.length !== 1) {
        return;
    }
    const product = visibleProducts.value[0];
    const prices = getPrices(product);
    if (prices.length !== 1 || prices[0].allowCustomPrice || !canOrder(product)) {
        return;
    }
    const max = getMaximum(product, prices[0]);
    if (max !== null && max < 1) {
        return;
    }
    setAmount(product, prices[0], 1);
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.bulk-product-list {
    .boxed {
        background: $color-background;
        // Nested inputs (radio, checkbox) and hover layers derive their colors from the current background
        --color-current-background: #{$color-background};
        --color-current-background-shade: #{$color-background-shade};
        --color-current-background-shade-darker: #{$color-background-shade-darker-darker};
        margin: 0 auto;
        border-radius: $border-radius;
        overflow: hidden;
        border: $border-width solid $color-border;
        @extend %style-input-shadow;
        --st-horizontal-padding: 20px;
        --st-vertical-padding: 7px;
        padding: 7px 20px;
    }

    .stacked-box {
        padding-left: 10px;
        padding-top: 10px;
        padding-bottom: 10px;
        --st-list-padding: 5px;
    }

    .custom-price-box {
        padding-top: 10px;
    }

    .error-box.small {
        margin-top: 10px;
    }

    h3 > .button.inline {
        vertical-align: middle;
        margin-left: 4px;
    }

    .amount-input {
        @extend %style-amount;
        border: 0;
        background: none;
        outline: none;
        padding: 0;
        margin-right: 15px;
        width: 40px;
        text-align: right;
        font-family: inherit;

        &::placeholder {
            color: $color-gray-4;
        }
    }

    // Same layer as the hover state of a selectable row, while the amount field has focus
    .st-list-item.amount-focused {
        &::after {
            content: '';
            position: absolute;
            top: -1px;
            left: calc(-1 * var(--added-st-horizontal-padding, 0px));
            right: calc(-1 * var(--added-st-horizontal-padding, 0px));
            bottom: 1px;
            background: var(--color-current-background-shade, #{$color-background-shade});
            z-index: -3;
            pointer-events: none;
            border-radius: min($border-radius, var(--added-st-horizontal-padding, 0px));
        }
    }
}
</style>
