<template>
    <form :class="embedded ? 'cart-item-view embedded' : 'st-view cart-item-view'" data-testid="cart-item-view" @submit.prevent="addToCart">
        <STNavigationBar v-if="!embedded" :title="cartItem.product.name">
            <template #left>
                <p v-if="(!webshop.isAllFree || pricedItem.getPriceWithDiscounts()) && !cartItem.productPrice.allowCustomPrice">
                    <span v-if="formattedPriceWithDiscount" class="style-tag discount">{{ formattedPriceWithDiscount }}</span>
                    <span v-else class="style-tag">{{ formattedPriceWithoutDiscount }}</span>
                </p>
            </template>
        </STNavigationBar>
        <component :is="embedded ? 'div' : 'main'" :class="{ container: embedded, small: true }">
            <!-- Embedded on the page of the webshop, which already has a title (often the same as the product) -->
            <h1 v-if="!embedded">
                {{ cartItem.product.name }}
            </h1>
            <h2 v-else-if="showTitle" class="larger">
                {{ cartItem.product.name }}
            </h2>

            <ImageGallery :images="images" />
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

            <STList v-if="(cartItem.product.type === 'Ticket' || cartItem.product.type === 'Voucher') && (cartItem.product.location || cartItem.product.dateRange)" class="info">
                <STListItem v-if="cartItem.product.location">
                    <h3 class="style-definition-label">
                        {{ $t('%8a') }}
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
                <hr>
                <STList>
                    <STListItem v-for="price in cartItem.product.filteredPrices({admin})" :key="price.id" class="no-border right-price" :selectable="canSelectPrice(price)" :disabled="!canSelectPrice(price)" element-name="label">
                        <template #left>
                            <Radio v-model="selectedPrice" :value="price" :name="cartItem.product.id+'price'" :disabled="!canSelectPrice(price)" />
                        </template>
                        <h4 class="style-title-list">
                            {{ price.name || $t('%CL') }}
                        </h4>

                        <p v-if="price.discountPrice" class="style-description-small">
                            {{ price.discountAmount === 1
                                ? $t('%ZkK', { price: formatPrice(price.discountPrice), amount: price.discountAmount.toString() })
                                : $t('%Zkc', { price: formatPrice(price.discountPrice), amount: price.discountAmount.toString() }) }}
                        </p>

                        <p v-if="getPriceStockText(price)" class="style-description-small">
                            {{ getPriceStockText(price) }}
                        </p>

                        <template v-if="!price.allowCustomPrice" #right>
                            {{ formatPrice(price.price) }}
                        </template>
                    </STListItem>
                </STList>
            </div>

            <template v-if="cartItem.productPrice.allowCustomPrice">
                <hr>
                <h2>{{ cartItem.productPrice.name || $t('%Zkv') }}</h2>
                <PriceInputBox v-model="cartItem.productPrice.price" class="max" data-testid="custom-price-input" :validator="errors.validator" :min="ProductPrice.customPriceMinimum" :max="ProductPrice.customPriceMaximum" />
            </template>

            <OptionMenuBox v-for="optionMenu in cartItem.product.optionMenus" :key="optionMenu.id" :error-box="errors.errorBox" :cart-item="cartItem" :option-menu="optionMenu" :cart="cart" :old-item="oldItem" :admin="admin" :webshop="webshop" />

            <FieldBox v-for="field in cartItem.product.customFields" :key="field.id" :field="field" :answers="cartItem.fieldAnswers" :error-box="errors.errorBox" />

            <template v-if="cartItem.product.enableCustomer && cartItem.customer">
                <hr>
                <h2>{{ $t('Gegevens deelnemer') }}</h2>
                <CustomerInputs :customer="cartItem.customer" :settings="cartItem.product.resolvedCustomerSettings" :name-title="$t('Naam')" :enable-autocomplete="false" :error-box="errors.errorBox" :validator="errors.validator" />
                <FillRecordCategoryBox v-if="customerRecordCategory" :category="customerRecordCategory" :value="cartItem" :validator="errors.validator" :force-mark-reviewed="true" :hide-title="true" :parent-error-box="errors.errorBox" @patch="patchRecordAnswers" />
            </template>

            <template v-if="canOrder && canSelectAmount">
                <hr>
                <h2>{{ $t('%M4') }}</h2>

                <STInputBox class="max">
                    <NumberInput v-model="cartItem.amount" :suffix="suffix" :suffix-singular="suffixSingular" :max="maximumRemaining" :min="1" :stepper="true" data-testid="amount-number-input" />
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

            <div v-if="!cartEnabled && buttonPrice === null && (pricedCheckout.priceBreakown.length > 1 || pricedCheckout.totalPrice > 0)" class="pricing-box max">
                <PriceBreakdownBox :price-breakdown="pricedCheckout.priceBreakown" />
            </div>

            <div v-if="canOrder && embedded" class="style-button-bar">
                <LoadingButton :loading="loading" class="max">
                    <button class="button primary full" type="submit" data-testid="save-button">
                        <span v-if="saveButton.iconLeft" :class="'icon ' + saveButton.iconLeft" />
                        <span>{{ saveButton.text }}</span>
                        <span v-if="buttonPrice" class="button-total">{{ formatPrice(buttonPrice) }}</span>
                        <span v-if="saveButton.iconRight" :class="'icon ' + saveButton.iconRight" />
                    </button>
                </LoadingButton>
            </div>
        </component>

        <STToolbar v-if="canOrder && !embedded">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="submit" data-testid="save-button">
                        <span v-if="saveButton.iconLeft" :class="'icon ' + saveButton.iconLeft" />
                        <span>{{ saveButton.text }}</span>
                        <span v-if="buttonPrice" class="button-total">{{ formatPrice(buttonPrice) }}</span>
                        <span v-if="saveButton.iconRight" :class="'icon ' + saveButton.iconRight" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts" setup>
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useCanDismiss, useDismiss, usePresent, useShow } from '@browser/navigation';
import type { CartItem, Checkout, PatchAnswers, ProductDateRange, Webshop } from '@stamhoofd/structures';
import { CartStockHelper, Customer, ProductPrice, ProductType, UitpasNumberAndPrice, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useContext } from '#hooks/useContext.ts';
import { patchObject } from '@common/encoding';
import { useRequestOwner } from '#hooks/networking/useRequestOwner';
import type { Ref } from 'vue';
import { computed, onMounted, ref, watch } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { getOrderButtonText } from '../helpers/webshopWording';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import NumberInput from '../inputs/NumberInput.vue';
import Radio from '../inputs/Radio.vue';
import UitpasNumberInput from '../inputs/UitpasNumberInput.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';

import PriceInputBox from '#inputs/PriceInputBox.vue';
import FieldBox from './FieldBox.vue';
import OptionMenuBox from './OptionMenuBox.vue';
import PriceBreakdownBox from './PriceBreakdownBox.vue';
import ImageGallery from '#images/ImageGallery.vue';
import FillRecordCategoryBox from '#records/components/FillRecordCategoryBox.vue';
import CustomerInputs from './CustomerInputs.vue';
import { validateUitpasNumbers } from './validateUitpasNumbers';

const props = withDefaults(defineProps<{
    admin?: boolean;
    cartItem: CartItem;
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null,
        component: { dismiss: ReturnType<typeof useDismiss>; canDismiss: boolean }) => void;
    oldItem?: CartItem | null;
    /**
     * Shown as an example in the dashboard: nothing is saved, so closing never asks for confirmation
     */
    isPreview?: boolean;
    /**
     * Rendered inside another view (e.g. the webshop page): no navigation bar, no product name and the save button at
     * the end of the form instead of in a toolbar
     */
    embedded?: boolean;
    /**
     * Embedded only: still show the product name, e.g. when the form is in a column next to the content of the page
     */
    showTitle?: boolean;
    /**
     * Live editing: every change is passed to this handler right away (e.g. to store the cart), so nothing is lost
     * when the page reloads and closing never asks to discard changes.
     * Pass the item that is in the cart as both `cartItem` and `oldItem`, so it is edited in place.
     */
    liveSaveHandler?: ((item: CartItem) => void) | null;
}>(), {
    admin: false,
    oldItem: null,
    isPreview: false,
    embedded: false,
    showTitle: false,
    liveSaveHandler: null,
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

// Match on id: the cart item price can differ from the product price when allowCustomPrice is enabled
const selectedPrice = computed({
    get: () => props.cartItem.product.filteredPrices({ admin: props.admin }).find(p => p.id === props.cartItem.productPrice.id) ?? props.cartItem.productPrice,
    set: (price: ProductPrice) => {
        if (props.cartItem.productPrice.id === price.id) {
            return;
        }
        // Clone: the cart item owns its own instance, so a custom price never mutates the webshop structure
        props.cartItem.productPrice = price.clone();
    },
});

onMounted(() => {
    onChangeItem();
    handleNewAmount(props.cartItem.amount);
    originalSelectedPriceId.value = props.cartItem.productPrice.id;
    // Snapshot after the setup above: handleNewAmount pads uitpasNumbers and the customer watcher creates an empty customer
    originalEncodedItem = encodeItem(props.cartItem);
});

let originalEncodedItem = '';

function encodeItem(item: CartItem) {
    return JSON.stringify(item.encode({ version: Version }));
}

// External changes should trigger a price update
watch(() => props.checkout, () => {
    onChangeItem();
});

watch(() => props.cartItem, () => {
    onChangeItem();
    liveSave();
}, { deep: true });

let lastLiveSavedItem = '';

function liveSave() {
    if (!props.liveSaveHandler) {
        return;
    }
    // Saving recalculates the prices of the item in the cart, which triggers the watcher again: only save real changes
    if (encodeItem(props.cartItem) === lastLiveSavedItem) {
        return;
    }
    props.liveSaveHandler(props.cartItem);
    lastLiveSavedItem = encodeItem(props.cartItem);
}

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
    try {
        const clonedCart = cart.value.clone();

        if (!cartEnabled.value) {
            clonedCart.clear();
        } else if (props.oldItem) {
            clonedCart.removeItem(props.oldItem);
        }

        props.cartItem.validate(props.webshop, clonedCart, {
            refresh: true,
            admin: props.admin,
            validateSeats: false,
        });

        if (props.cartItem.productPrice.uitpasBaseProductPriceId !== null) {
            await validateUitpasNumbers(props.cartItem, context.value.optionalAuthenticatedServer, owner);
        }
    } catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        return false;
    }
    errors.errorBox = null;
    return true;
}

const context = useContext();

const loading = ref(false);

async function addToCart() {
    console.log('Adding to cart', props.cartItem.product.name, 'with amount', props.cartItem.amount);
    if (loading.value) {
        return;
    }

    loading.value = true;

    // Inputs may throw their validation error instead of returning false
    try {
        if (!(await errors.validator.validate())) {
            loading.value = false;
            return;
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
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
    } catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        loading.value = false;
        return;
    }
    loading.value = false;
}

function chooseSeats() {
    const component = AsyncComponent(() => import('./ChooseSeatsView.vue'), {
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
    } else {
        // Sheet
        show({
            components: [
                component,
            ],
        }).catch(console.error);
    }
}

const cartEnabled = computed(() => props.webshop.shouldEnableCart);

const saveButton = computed(() => {
    if (willNeedSeats.value) {
        return { iconLeft: null, text: $t('%k5'), iconRight: 'arrow-right' };
    }
    if (props.oldItem && cartEnabled.value) {
        return { iconLeft: 'basket', text: $t('%1Op'), iconRight: null };
    }
    if (cartEnabled.value) {
        return { iconLeft: 'basket', text: $t('%SN'), iconRight: null };
    }
    if (props.admin) {
        return { iconLeft: null, text: $t('%16p'), iconRight: 'arrow-right' };
    }
    // Without a cart, saving the item starts the order
    return { iconLeft: null, text: getOrderButtonText(props.webshop, pricedCheckout.value.totalPrice), iconRight: 'arrow-right' };
});
const buttonPrice = computed(() => {
    if (props.admin || willNeedSeats.value) {
        return null;
    }
    if (cartEnabled.value) {
        return pricedItem.value.getPriceWithDiscounts();
    }
    // The total is only shown separately when other costs (e.g. administration fees or delivery) need to be listed
    if (pricedCheckout.value.priceBreakown.length > 1) {
        return null;
    }
    return pricedCheckout.value.totalPrice;
});
const withSeats = computed(() => props.cartItem.product.seatingPlanId !== null);
const suffixSingular = computed(() => {
    if (props.cartItem.product.type === ProductType.Ticket) {
        return $t('%o');
    }
    return props.cartItem.product.type === ProductType.Person ? $t('%12P') : $t('%12Q');
});

const suffix = computed(() => {
    if (props.cartItem.product.type === ProductType.Ticket) {
        return $t('%m');
    }
    return props.cartItem.product.type === ProductType.Person ? $t('%12R') : $t('%12S');
});

const images = computed(() => props.cartItem.product.images);
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

const canSelectAmount = computed(() => product.value.maxPerOrder !== 1 && props.webshop.allowsMultiple(product.value) && !product.value.enableCustomer);

// The structure only stores a customer when the product asks for one
watch(() => product.value.enableCustomer, (enabled) => {
    if (enabled && !props.cartItem.customer) {
        props.cartItem.customer = Customer.create({});
    }
}, { immediate: true });

const customerRecordCategory = computed(() => product.value.enableCustomer ? product.value.resolvedCustomerSettings.recordCategory : null);

function patchRecordAnswers(patch: PatchAnswers) {
    props.cartItem.recordAnswers = patchObject(props.cartItem.recordAnswers, patch);
}

// Kept here, so switching between prices doesn't clear typed numbers. The item only holds them for a UiTPAS price:
// live editing stores the item in the cart right away, and validating the cart rejects UiTPAS numbers on other prices.
const uitpasNumbers = ref(props.cartItem.uitpasNumbers);

watch([() => props.cartItem.productPrice.uitpasBaseProductPriceId, uitpasNumbers], ([uitpasBaseProductPriceId, numbers]) => {
    props.cartItem.uitpasNumbers = uitpasBaseProductPriceId ? numbers : [];
}, { immediate: true });

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
    } else if (newAmount === 0) {
        // clear all
        uitpasNumbers.value = [];
    } else if (newAmount < uitpasNumbers.value.length) {
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
    if (props.isPreview || props.liveSaveHandler || encodeItem(props.cartItem) === originalEncodedItem) {
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

    .description {
        @extend %style-description;
        padding-top: 15px;
        white-space: pre-wrap;
    }

    .info {
        padding-top: 15px;
    }

    h1 + .description, h2 + .description {
        // Remove duplicate padding
        padding-top: 0;
    }

    h1 + .info, h2 + .info {
        padding-top: 0;
    }

    .pricing-box {
        padding-top: 15px;
    }

    .button-total {
        opacity: 0.7;
        padding-left: 5px;
    }

    // Embedded without a title: no line above the first part of the form (e.g. the prices) when nothing precedes it
    &.embedded > .container > .st-errors-default:first-child + hr,
    &.embedded > .container > .st-errors-default:first-child + .container > hr:first-child {
        display: none;
    }

    // Embedded right below the title, or without a title (the spacing above the form is set by the parent, like for a list of products)
    &.embedded > .container > .st-errors-default:first-child + .info,
    &.embedded > .container > h2:first-child + .st-errors-default + .info {
        padding-top: 0;
    }
}

</style>
