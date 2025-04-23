<template>
    <form class="st-view cart-item-view" @submit.prevent="addToCart">
        <STNavigationBar :title="cartItem.product.name">
            <template #left>
                <p v-if="!webshop.isAllFree || pricedItem.getPriceWithDiscounts()">
                    <span v-if="formattedPriceWithDiscount" class="style-tag discount">{{ formattedPriceWithDiscount }}</span>
                    <span v-else class="style-tag">{{ formattedPriceWithoutDiscount }}</span>
                </p>
            </template>
        </STNavigationBar>
        <main>
            <h1>{{ cartItem.product.name }}</h1>

            <figure v-if="imageSrc" class="image-box">
                <div>
                    <img :src="imageSrc" :width="image.width" :height="image.height">
                </div>
            </figure>
            <p v-if="cartItem.product.description" class="description" v-text="cartItem.product.description" />

            <p v-if="oldItem && oldItem.cartError" class="error-box small">
                {{ oldItem.cartError.getHuman() }}
            </p>

            <p v-if="!cartItem.product.isEnabled" class="info-box">
                {{ cartItem.product.isEnabledTextLong }}
            </p>

            <p v-else-if="cartItem.product.isSoldOut" class="warning-box">
                {{ $t('f3109566-4bdf-485d-93e8-384857eb585e') }}
            </p>

            <p v-else-if="areSeatsSoldOut" class="warning-box">
                {{ $t('37dfb251-cd3a-409c-8fd0-30de600d2db0') }}
            </p>

            <p v-else-if="!canOrder" class="warning-box">
                {{ $t('351070c7-5df7-4c0b-8371-476e6737e941') }}
            </p>

            <p v-else-if="cartItem.product.closesSoonText" class="info-box">
                {{ cartItem.product.closesSoonText }}
            </p>

            <p v-if="remainingReduced > 0" class="info-box">
                {{ $t('cf335b59-ab51-4975-9c09-45325d7eb90c', {amount: cartItem.productPrice.discountAmount.toString(), price: formatPrice(discountPrice) }) }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList v-if="(cartItem.product.type === 'Ticket' || cartItem.product.type === 'Voucher') && cartItem.product.location" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('7eec15d0-4d60-423f-b860-4f3824271578') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ cartItem.product.location.name }}
                    </p>
                    <p v-if="cartItem.product.location.address" class="style-description-small">
                        {{ cartItem.product.location.address }}
                    </p>
                </STListItem>

                <STListItem v-if="cartItem.product.dateRange">
                    <h3 class="style-definition-label">
                        {{ $t('13081716-3941-44b8-87b4-398ab2288419') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(cartItem.product.dateRange) }}
                    </p>
                </STListItem>
            </STList>

            <div v-if="cartItem.product.filteredPrices({admin}).length > 1" class="container">
                <hr><STList>
                    <STListItem v-for="price in cartItem.product.filteredPrices({admin})" :key="price.id" class="no-border right-price" :selectable="canSelectPrice(price)" :disabled="!canSelectPrice(price)" element-name="label">
                        <template #left>
                            <Radio v-model="cartItem.productPrice" :value="price" :name="cartItem.product.id+'price'" :disabled="!canSelectPrice(price)" />
                        </template>
                        <h4 class="style-title-list">
                            {{ price.name || 'Naamloos' }}
                        </h4>

                        <p v-if="price.discountPrice" class="style-description-small">
                            {{ formatPrice(price.discountPrice) }} / stuk vanaf {{ price.discountAmount }} {{ price.discountAmount === 1 ? 'stuk' : 'stuks' }}
                        </p>

                        <p v-if="getPriceStockText(price)" class="style-description-small">
                            {{ getPriceStockText(price) }}
                        </p>

                        <template #right>
                            {{ formatPrice(price.price) }}
                        </template>
                    </STListItem>
                </STList>
            </div>

            <OptionMenuBox v-for="optionMenu in cartItem.product.optionMenus" :key="optionMenu.id" :cart-item="cartItem" :option-menu="optionMenu" :cart="cart" :old-item="oldItem" :admin="admin" :webshop="webshop" />

            <FieldBox v-for="field in cartItem.product.customFields" :key="field.id" :field="field" :answers="cartItem.fieldAnswers" :error-box="errors.errorBox" />

            <template v-if="canOrder && canSelectAmount">
                <hr><h2>{{ $t('697df3e7-fbbf-421d-81c2-9c904dce4842') }}</h2>

                <NumberInput v-model="cartItem.amount" :suffix="suffix" :suffix-singular="suffixSingular" :max="maximumRemaining" :min="1" :stepper="true" />

                <p v-if="stockText" class="st-list-description" v-text="stockText" />
            </template>

            <div v-if="!cartEnabled && (pricedCheckout.priceBreakown.length > 1 || pricedCheckout.totalPrice > 0)" class="pricing-box max">
                <PriceBreakdownBox :price-breakdown="pricedCheckout.priceBreakown" />
            </div>
        </main>

        <STToolbar v-if="canOrder">
            <template #right>
                <button v-if="willNeedSeats" class="button primary" type="submit">
                    <span>{{ $t('88fa4580-52a2-4b79-aa03-cd31eb98f3e1') }}</span>
                    <span class="icon arrow-right" />
                </button>
                <button v-else-if="oldItem && cartEnabled" class="button primary" type="submit">
                    <span class="icon basket" />
                    <span>{{ $t('a103aa7c-4693-4bd2-b903-d14b70bfd602') }}</span>
                </button>
                <button v-else class="button primary" type="submit">
                    <span v-if="cartEnabled" class="icon basket" />
                    <span v-if="cartEnabled">{{ $t('36ba68cb-2159-4179-8ded-89e73d47cd87') }}</span>
                    <span v-else>{{ $t('c72a9ab2-98a0-4176-ba9b-86fe009fa755') }}</span>
                    <span v-if="!cartEnabled" class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useCanDismiss, useDismiss, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CartItem, CartStockHelper, Checkout, ProductDateRange, ProductPrice, ProductType, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed, onMounted, ref, Ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import NumberInput from '../inputs/NumberInput.vue';
import Radio from '../inputs/Radio.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import ChooseSeatsView from './ChooseSeatsView.vue';
import FieldBox from './FieldBox.vue';
import OptionMenuBox from './OptionMenuBox.vue';
import PriceBreakdownBox from './PriceBreakdownBox.vue';

const props = withDefaults(defineProps<{
    admin?: boolean;
    cartItem: CartItem;
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean }) => void;
    oldItem?: CartItem | null;

}>(), {
    admin: false,
    oldItem: null,
});

const present = usePresent();
const show = useShow();
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const pricedItem = ref(props.cartItem) as Ref<CartItem>;
const pricedCheckout = ref(props.checkout) as Ref<Checkout>;
const errors = useErrors();

const willNeedSeats = computed(() => withSeats.value);
const cart = computed(() => props.checkout.cart);

onMounted(() => {
    onChangeItem();
    console.log('Cartview', this, props.cartItem);
});

// External changes should trigger a price update
watch(() => props.checkout, () => {
    onChangeItem();
});

watch(() => props.cartItem, () => {
    onChangeItem();
}, { deep: true });

function onChangeItem() {
    // Update the cart price on changes
    const clonedCheckout = props.checkout.clone();
    if (props.oldItem) {
        clonedCheckout.cart.removeItem(props.oldItem);
    }
    const pricedItemClone = props.cartItem.clone();
    clonedCheckout.cart.addItem(pricedItemClone, false); // No merging (otherwise prices are not updated)

    // Calculate prices
    clonedCheckout.update(props.webshop);
    pricedCheckout.value = clonedCheckout;
    pricedItem.value = pricedItemClone;
}

const formattedPriceWithDiscount = computed(() => pricedItem.value.getFormattedPriceWithDiscount());
const formattedPriceWithoutDiscount = computed(() => pricedItem.value.getFormattedPriceWithoutDiscount());

function validate() {
    try {
        const clonedCart = cart.value.clone();

        if (!cartEnabled.value) {
            clonedCart.clear();
        }
        else if (props.oldItem) {
            clonedCart.removeItem(props.oldItem);
        }

        props.cartItem.validate(props.webshop, clonedCart, {
            refresh: true,
            admin: props.admin,
            validateSeats: false,
        });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        return false;
    }
    errors.errorBox = null;
    return true;
}

function addToCart() {
    if (!validate()) {
        return;
    }

    if (willNeedSeats.value) {
        chooseSeats();
        return;
    }

    try {
        props.saveHandler(props.cartItem, props.oldItem, {
            dismiss,
            canDismiss: canDismiss.value,
        });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        return;
    }
}

function chooseSeats() {
    const component = new ComponentWithProperties(ChooseSeatsView, {
        cartItem: props.cartItem,
        oldItem: props.oldItem,
        webshop: props.webshop,
        admin: props.admin,
        cart: cart.value,
        saveHandler: props.saveHandler,
    });

    if (!canDismiss.value) {
        present({
            components: [
                component,
            ],
            modalDisplayStyle: 'sheet',
        }).catch(console.error);
    }
    else {
        // Sheet
        show({
            components: [
                component,
            ],
        }).catch(console.error);
    }
}

const cartEnabled = computed(() => props.webshop.shouldEnableCart);
const withSeats = computed(() => props.cartItem.product.seatingPlanId !== null);
const suffixSingular = computed(() => {
    if (props.cartItem.product.type === ProductType.Ticket) {
        return 'ticket';
    }
    return props.cartItem.product.type === ProductType.Person ? 'persoon' : 'stuk';
});

const suffix = computed(() => {
    if (props.cartItem.product.type === ProductType.Ticket) {
        return 'tickets';
    }
    return props.cartItem.product.type === ProductType.Person ? 'personen' : 'stuks';
});

const image = computed(() => props.cartItem.product.images[0]?.getResolutionForSize(600, undefined));
const imageSrc = computed(() => image.value?.file?.getPublicPath());
const product = computed(() => props.cartItem.product);
const remainingReduced = computed(() => {
    if (props.cartItem.productPrice.discountPrice === null) {
        return 0;
    }
    return props.cartItem.productPrice.discountAmount - count.value;
});
const discountPrice = computed(() => props.cartItem.productPrice.discountPrice ?? 0);
const count = computed(() => {
    return cart.value.items.reduce((prev, item) => {
        if (item.product.id !== product.value.id) {
            return prev;
        }
        return prev + item.amount;
    }, 0) - (props.oldItem?.amount ?? 0);
});

const availableStock = computed(() => {
    return props.cartItem.getAvailableStock(props.oldItem, cart.value, props.webshop, props.admin);
});

const maximumRemaining = computed(() => props.cartItem.getMaximumRemaining(props.oldItem, cart.value, props.webshop, props.admin));
const maximumRemainingAcrossOptions = computed(() => {
    return CartStockHelper.getRemainingAcrossOptions({
        product: product.value,
        oldItem: props.oldItem,
        cart: cart.value,
        webshop: props.webshop,
        admin: props.admin,
        amount: props.cartItem.amount,
    }, { inMultipleCartItems: false });
});

const stockText = computed(() => {
    const maximumRemainingValue = maximumRemaining.value;
    return availableStock.value.filter(v => v.text !== null && (!v.remaining || !maximumRemainingValue || v.remaining <= maximumRemainingValue)).map(s => s.text)[0];
});

function getPriceStock(price: ProductPrice) {
    const priceStock = CartStockHelper.getPriceStock({ product: product.value, oldItem: props.oldItem, cart: cart.value, productPrice: price, webshop: props.webshop, admin: props.admin, amount: props.cartItem.amount });
    if (!priceStock) {
        return null;
    }

    if (priceStock.remaining !== null && maximumRemainingAcrossOptions.value !== null && priceStock.remaining > maximumRemainingAcrossOptions.value) {
        // Doesn't matter to show this
        return null;
    }
    return priceStock;
}

function getPriceStockText(price: ProductPrice) {
    // Don't show text if all options are sold out
    if (maximumRemainingAcrossOptions.value === 0) {
        return null;
    }

    return getPriceStock(price)?.shortText;
}

function canSelectPrice(price: ProductPrice) {
    if (maximumRemainingAcrossOptions.value === 0) {
        return false;
    }

    return getPriceStock(price)?.remaining !== 0;
}

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}

const areSeatsSoldOut = computed(() => {
    return CartStockHelper.getSeatsStock({ product: product.value, oldItem: props.oldItem, cart: cart.value, webshop: props.webshop, admin: props.admin, amount: props.cartItem.amount })?.stock === 0;
});

const canOrder = computed(() => {
    return (maximumRemaining.value === null || maximumRemaining.value > 0) && (product.value.isEnabled || props.admin);
    // return (props.admin || ((maximumRemaining.value === null || maximumRemaining.value > 0 || !!props.oldItem) && product.value.isEnabled)) && !this.areSeatsSoldOut
});

const canSelectAmount = computed(() => product.value.maxPerOrder !== 1 && product.value.allowMultiple);
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-item-view {
    .sheet & {
       --st-horizontal-padding: 25px;
    }

    .image-box {
        position: relative;
        overflow: hidden;
        border-radius: $border-radius;

        > div {
            display: flex;
            flex-direction: row;
            justify-content: center;
        }

        img {
            height: auto;
            max-width: 100%;
            border-radius: $border-radius;
            object-fit: cover;
        }
    }
    .image {
        width: 100%;
        border-radius: $border-radius;
    }

    .description {
        @extend .style-description;
        padding-top: 15px;
        white-space: pre-wrap;
    }

    .info {
        padding-top: 15px;
    }

    h1 + .description {
        // Remove duplicate padding
        padding-top: 0;
    }

    h1 + .info {
        padding-top: 0;
    }

    .pricing-box {
        padding-top: 15px;
    }
}

</style>
