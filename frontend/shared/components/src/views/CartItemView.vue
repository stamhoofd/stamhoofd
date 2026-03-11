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
                {{ $t('%k1') }}
            </p>

            <p v-else-if="areSeatsSoldOut" class="warning-box">
                {{ $t('%k2') }}
            </p>

            <p v-else-if="!canOrder" class="warning-box">
                {{ $t('%k3') }}
            </p>

            <p v-else-if="cartItem.product.closesSoonText" class="info-box">
                {{ cartItem.product.closesSoonText }}
            </p>

            <p v-if="remainingReduced > 0" class="info-box">
                {{ $t('%k4', {amount: cartItem.productPrice.discountAmount.toString(), price: formatPrice(discountPrice) }) }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList v-if="(cartItem.product.type === 'Ticket' || cartItem.product.type === 'Voucher') && cartItem.product.location" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%TW') }}
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
                        {{ $t('%Vc') }}
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

            <OptionMenuBox v-for="optionMenu in cartItem.product.optionMenus" :key="optionMenu.id" :error-box="errors.errorBox" :cart-item="cartItem" :option-menu="optionMenu" :cart="cart" :old-item="oldItem" :admin="admin" :webshop="webshop" />

            <FieldBox v-for="field in cartItem.product.customFields" :key="field.id" :field="field" :answers="cartItem.fieldAnswers" :error-box="errors.errorBox" />

            <template v-if="canOrder && canSelectAmount">
                <hr><h2>{{ $t('%M4') }}</h2>

                <STInputBox class="max">
                    <NumberInput v-model="cartItem.amount" :suffix="suffix" :suffix-singular="suffixSingular" :max="maximumRemaining" :min="1" :stepper="true" />
                </STInputBox>

                <p v-if="stockText" class="style-description-small" v-text="stockText" />
            </template>

            <template v-if="canOrder && props.cartItem.productPrice.uitpasBaseProductPriceId !== null">
                <hr><h2>{{ cartItem.amount < 2 ? $t('%wF') : $t('%1B4') }}</h2>
                <div v-for="(value, index) in uitpasNumbers" :key="index">
                    <UitpasNumberInput
                        v-model="uitpasNumbers[index].uitpasNumber"
                        :placeholder="index === 0 ? 'Geef jouw UiTPAS-nummer in' : 'UiTPAS-nummer ' + (index + 1)"
                        :class="'max uitpas-number-input'"
                        :validator="errors.validator"
                        :required="true"
                        :error-fields="'uitpasNumbers.' + index"
                        :error-box="errors.errorBox"
                    />

                    <p
                        v-if="originalSelectedPriceId === cartItem.productPrice.id
                            && cartItem.calculatedPrices[index]
                            && cartItem.calculatedPrices[index].price !== cartItem.productPrice.price"
                        class="style-description-small"
                    >
                        {{ $t('%1DT', {
                            specificPrice: formatPrice(cartItem.calculatedPrices[index].price),
                            generalPrice: formatPrice(cartItem.productPrice.price)
                        }) }}
                    </p>
                </div>
            </template>

            <div v-if="!cartEnabled && (pricedCheckout.priceBreakown.length > 1 || pricedCheckout.totalPrice > 0)" class="pricing-box max">
                <PriceBreakdownBox :price-breakdown="pricedCheckout.priceBreakown" />
            </div>
        </main>

        <STToolbar v-if="canOrder">
            <template #right>
                <LoadingButton :loading="loading">
                    <button v-if="willNeedSeats" class="button primary" type="submit">
                        <span>{{ $t('%k5') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                    <button v-else-if="oldItem && cartEnabled" class="button primary" type="submit">
                        <span class="icon basket" />
                        <span>{{ $t('%v7') }}</span>
                    </button>
                    <button v-else class="button primary" type="submit">
                        <span v-if="cartEnabled" class="icon basket" />
                        <span v-if="cartEnabled">{{ $t('%SN') }}</span>
                        <span v-else>{{ $t('%16p') }}</span>
                        <span v-if="!cartEnabled" class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, useCanDismiss, useDismiss, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CartItem, CartStockHelper, Checkout, ProductDateRange, ProductPrice, ProductType, UitpasNumberAndPrice, UitpasPriceCheckRequest, UitpasPriceCheckResponse, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useRequestOwner } from '@stamhoofd/networking';
import { computed, onMounted, ref, Ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import { useContext } from '../hooks';
import NumberInput from '../inputs/NumberInput.vue';
import Radio from '../inputs/Radio.vue';
import UitpasNumberInput from '../inputs/UitpasNumberInput.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
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
const owner = useRequestOwner();

const willNeedSeats = computed(() => withSeats.value);
const cart = computed(() => props.checkout.cart);
const originalSelectedPriceId = ref('');

onMounted(() => {
    onChangeItem();
    handleNewAmount(props.cartItem.amount);
    originalSelectedPriceId.value = props.cartItem.productPrice.id;
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
    if (!cartEnabled.value) {
        clonedCheckout.cart.clear();
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

async function validate() {
    // clear only on save, so fast switchting between items doesn't clear the UiTPAS numbers
    if (!props.cartItem.productPrice.uitpasBaseProductPriceId) {
        props.cartItem.uitpasNumbers = [];
    }

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

        if (props.cartItem.productPrice.uitpasBaseProductPriceId !== null) {
            await validateUitpasNumbers();
        }
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        return false;
    }
    errors.errorBox = null;
    return true;
}

const context = useContext();

async function validateUitpasNumbers() {
    const baseProductPrice = props.cartItem.product.prices.find(p => p.id === props.cartItem.productPrice.uitpasBaseProductPriceId);
    if (!baseProductPrice) {
        return;
    }

    // verify the UiTPAS numbers are valid for social tariff (call to backend)
    try {
        const response = await context.value.optionalAuthenticatedServer.request({
            method: 'POST',
            path: '/uitpas',
            owner: owner,
            shouldRetry: false,
            body: UitpasPriceCheckRequest.create({
                basePrice: baseProductPrice.price,
                reducedPrice: props.cartItem.productPrice.price,
                uitpasNumbers: props.cartItem.uitpasNumbers.map(p => p.uitpasNumber),
                uitpasEventUrl: props.cartItem.product.uitpasEvent?.url ?? null, // null for non-official flow, not null for official flow
            }),
            decoder: UitpasPriceCheckResponse as Decoder<UitpasPriceCheckResponse>,
        }); // will throw if one of the uitpas numbers is invalid
        const reducedPrices = response.data.prices;
        if (reducedPrices.length < props.cartItem.uitpasNumbers.length) {
            // Should already be thrown by the backend
            throw new SimpleError({
                code: 'invalid_uitpas_numbers',
                message: 'Not all uitpas numbers were valid',
                human: $t('%1B5'),
            });
        }
        for (let i = 0; i < props.cartItem.uitpasNumbers.length; i++) {
            props.cartItem.uitpasNumbers[i].price = reducedPrices[i];
        }
    }
    catch (e) {
        if (!Request.isAbortError(e)) {
            throw e;
        }
    }
}

const loading = ref(false);

async function addToCart() {
    console.log('Adding to cart', props.cartItem.product.name, 'with amount', props.cartItem.amount);
    if (loading.value) {
        return;
    }

    loading.value = true;

    if (!(await errors.validator.validate())) {
        loading.value = false;
        return;
    }

    if (!(await validate())) {
        loading.value = false;
        return;
    }

    if (willNeedSeats.value) {
        chooseSeats();
        loading.value = false;
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
        loading.value = false;
        return;
    }
    loading.value = false;
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
        return $t(`%o`);
    }
    return props.cartItem.product.type === ProductType.Person ? $t(`%12P`) : $t(`%12Q`);
});

const suffix = computed(() => {
    if (props.cartItem.product.type === ProductType.Ticket) {
        return $t(`%m`);
    }
    return props.cartItem.product.type === ProductType.Person ? $t(`%12R`) : $t(`%12S`);
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

const uitpasNumbers = ref(props.cartItem.uitpasNumbers);
const originalUitpasNumbers = props.cartItem.uitpasNumbers.map(u => u.uitpasNumber);

watch(() => props.cartItem.amount, handleNewAmount);

function handleNewAmount(newAmount: number) {
    if (newAmount > uitpasNumbers.value.length) {
        // add empty strings to the end
        for (let i = uitpasNumbers.value.length; i < newAmount; i++) {
            const u = UitpasNumberAndPrice.create({
                uitpasNumber: '',
                price: props.cartItem.productPrice.price,
            });
            uitpasNumbers.value.push(u);
        }
    }
    else if (newAmount === 0) {
        // clear all
        uitpasNumbers.value = [];
    }
    else if (newAmount < uitpasNumbers.value.length) {
        // start removing empty strings from the end
        let index = uitpasNumbers.value.length - 1;
        do {
            if (uitpasNumbers.value[index].uitpasNumber === '') {
                uitpasNumbers.value.splice(index, 1);
            }
            index--;
        } while (uitpasNumbers.value.length > newAmount && index >= 0);
        // if there are no more empty strings, remove the last ones
        uitpasNumbers.value.splice(newAmount);
    }
}

const shouldNavigateAway = async () => {
    console.log('Checking if should navigate away from UitpasNumberInput');
    if (originalUitpasNumbers.length === uitpasNumbers.value.length && originalUitpasNumbers.every((val, index) => val === uitpasNumbers.value[index].uitpasNumber)) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

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
