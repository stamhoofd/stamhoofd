<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" :title="title" data-testid="details-step" class="bulk-item-details-view" @save="goNext">
        <h1>{{ title }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-for="entry of entries" :key="entry.item.id">
            <hr>
            <h2>{{ entry.title }}</h2>
            <p v-if="entry.subtitle" class="style-description-block">
                {{ entry.subtitle }}
            </p>

            <STCard data-testid="details-item">
                <STErrorsDefault :error-box="entry.errors.errorBox" />

                <template v-if="entry.item.product.enableCustomer && entry.item.customer">
                    <CustomerInputs :customer="entry.item.customer" :settings="entry.item.product.resolvedCustomerSettings" :name-title="$t('%1Os')" :enable-autocomplete="false" :error-box="entry.errors.errorBox" :validator="entry.errors.validator" @change="checkoutManager.saveCart()" />
                    <FillRecordCategoryBox v-if="entry.item.product.resolvedCustomerSettings.recordCategory" :category="entry.item.product.resolvedCustomerSettings.recordCategory" :value="entry.item" :validator="entry.errors.validator" :force-mark-reviewed="true" :hide-title="true" :parent-error-box="entry.errors.errorBox" @patch="patchRecordAnswers(entry.item, $event)" />
                </template>

                <OptionMenuBox v-for="optionMenu in entry.item.product.optionMenus" :key="optionMenu.id" :error-box="entry.errors.errorBox" :cart-item="entry.item" :option-menu="optionMenu" :cart="cart" :old-item="entry.item" :webshop="webshop" />

                <FieldBox v-for="field in entry.item.product.customFields" :key="field.id" :field="field" :answers="entry.item.fieldAnswers" :error-box="entry.errors.errorBox" />

                <template v-if="entry.item.productPrice.uitpasBaseProductPriceId !== null && entry.item.uitpasNumbers[0]">
                    <hr v-if="hasQuestionsAboveUitpas(entry.item)" class="style-hr">
                    <h3>{{ $t('%wF') }}</h3>
                    <UitpasNumberInput v-model="entry.item.uitpasNumbers[0].uitpasNumber" :placeholder="$t('%Zzz')" class="max" :validator="entry.errors.validator" :required="true" error-fields="uitpasNumbers.0" :error-box="entry.errors.errorBox" />
                </template>
            </STCard>
        </template>

        <PriceBreakdownBox v-if="pricedCheckout.priceBreakown.length > 1 || pricedCheckout.totalPrice > 0" :price-breakdown="pricedCheckout.priceBreakown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { patchObject } from '@common/encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@common/errors';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import UitpasNumberInput from '@stamhoofd/components/inputs/UitpasNumberInput.vue';
import STCard from '@stamhoofd/components/layout/STCard.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import OptionMenuBox from '@stamhoofd/components/views/OptionMenuBox.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import type { CartItem, PatchAnswers } from '@stamhoofd/structures';
import { Customer, UitpasNumberAndPrice, Version } from '@stamhoofd/structures';
import { computed, reactive, ref, watch } from 'vue';

import { validateUitpasNumbers } from '@stamhoofd/components/views/validateUitpasNumbers.ts';
import { useCheckoutContinue } from '../../composables/useCheckoutContinue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { cartItemNeedsDetails } from './CheckoutStepsManager';

interface ItemErrors {
    errorBox: ErrorBox | null;
    validator: Validator;
    /** Encoded item at the time the error was set: the error disappears once the visitor edits the item */
    snapshot: string | null;
}

const props = defineProps<{
    continueCheckout: (navigate: NavigationActions) => Promise<void>;
}>();

const loading = ref(false);
const errors = useErrors();
const owner = useRequestOwner();
const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const navigationActions = useNavigationActions();

const webshop = computed(() => webshopManager.webshop);
const cart = computed(() => checkoutManager.cart);
const title = $t('%a0J');

// One error box + validator per item, keyed on the item id so they survive cart changes
const itemErrors = reactive(new Map<string, ItemErrors>());

const entries = computed(() => {
    const counters = new Map<string, number>();
    return cart.value.items.filter(i => cartItemNeedsDetails(i)).map((item) => {
        const count = (counters.get(item.product.id) ?? 0) + 1;
        counters.set(item.product.id, count);

        const subtitle: string[] = [];
        if (item.product.prices.length > 1) {
            subtitle.push(item.productPrice.name);
        }
        if (item.seats.length > 0) {
            subtitle.push(item.seats.map(s => s.getNameString(webshop.value, item.product)).join(', '));
        }

        return {
            item,
            title: item.product.name + ' ' + count,
            subtitle: subtitle.join(' • '),
            // Created by prepareItems, which runs on every cart change before rendering
            errors: itemErrors.get(item.id)!,
        };
    });
});

/**
 * Give every item the objects its inputs bind to, so the template never has to create them while rendering
 */
function prepareItems() {
    for (const id of itemErrors.keys()) {
        if (!cart.value.items.some(i => i.id === id)) {
            itemErrors.delete(id);
        }
    }
    for (const item of cart.value.items) {
        if (!itemErrors.has(item.id)) {
            itemErrors.set(item.id, { errorBox: null, validator: new Validator(), snapshot: null });
        }
        if (item.product.enableCustomer && !item.customer) {
            item.customer = Customer.create({});
        }
        if (item.productPrice.uitpasBaseProductPriceId !== null && item.uitpasNumbers.length === 0) {
            item.uitpasNumbers.push(UitpasNumberAndPrice.create({ uitpasNumber: '', price: item.productPrice.price }));
        }
    }
}

function hasQuestionsAboveUitpas(item: CartItem) {
    return item.product.enableCustomer || item.product.optionMenus.length > 0 || item.product.customFields.length > 0;
}

function patchRecordAnswers(item: CartItem, patch: PatchAnswers) {
    item.recordAnswers = patchObject(item.recordAnswers, patch);
    checkoutManager.saveCart();
}

function snapshotOf(item: CartItem) {
    return JSON.stringify(item.encode({ version: Version }));
}

function setItemError(entry: { item: CartItem; errors: ItemErrors }, error: unknown | null) {
    entry.errors.errorBox = error === null ? null : new ErrorBox(error);
    entry.errors.snapshot = error === null ? null : snapshotOf(entry.item);
}

// Live price preview (options change the price) + drop errors of items that got edited since
const pricedCheckout = ref(checkoutManager.checkout.clone());
function onCartChanged() {
    prepareItems();
    const clone = checkoutManager.checkout.clone();
    clone.update(webshop.value);
    pricedCheckout.value = clone;

    for (const entry of entries.value) {
        if (entry.errors.errorBox && entry.errors.snapshot !== snapshotOf(entry.item)) {
            setItemError(entry, null);
        }
    }
}
watch(() => cart.value, () => onCartChanged(), { deep: true, immediate: true });

/**
 * Attribute a cart error to the items it belongs to by re-validating every item locally
 */
function showCartError(error: unknown) {
    let matched = false;
    for (const entry of entries.value) {
        const item = entry.item;
        if (item.cartError) {
            setItemError(entry, item.cartError);
            matched = true;
            continue;
        }
        try {
            cart.value.validateItem(webshop.value, item);
            setItemError(entry, null);
        } catch (e) {
            setItemError(entry, e);
            matched = true;
        }
    }

    // Errors that belong to no item (e.g. duplicate UiTPAS numbers across items)
    errors.errorBox = matched ? null : new ErrorBox(error);
}

// Set by handleCartError after it popped back to this step, which can stay mounted below the later steps
watch(() => checkoutManager.pendingCartError, (pending) => {
    if (pending) {
        checkoutManager.pendingCartError = null;
        showCartError(pending);
    }
}, { immediate: true });

useCheckoutContinue(goNext);

async function goNext() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    let valid = true;
    for (const entry of entries.value) {
        // Inputs may throw their validation error instead of returning false
        try {
            if (!await entry.errors.validator.validate()) {
                valid = false;
            }
        } catch (e) {
            setItemError(entry, e);
            valid = false;
        }
    }
    if (!valid) {
        loading.value = false;
        return;
    }

    // In order: only the items before an item count against its stock
    const validEntries = entries.value.filter((entry) => {
        try {
            cart.value.validateItem(webshop.value, entry.item);
            return true;
        } catch (e) {
            console.error(e);
            setItemError(entry, e);
            valid = false;
            return false;
        }
    });

    // One request per item with UiTPAS numbers, at the same time
    await Promise.all(validEntries.map(async (entry) => {
        try {
            await validateUitpasNumbers(entry.item, webshopManager.optionalAuthenticatedServer, owner);
            setItemError(entry, null);
        } catch (e) {
            console.error(e);
            setItemError(entry, e);
            valid = false;
        }
    }));
    if (!valid) {
        loading.value = false;
        return;
    }

    checkoutManager.saveCart();

    try {
        await props.continueCheckout(navigationActions);
    } catch (e) {
        console.error(e);
        // handleCartError already ran (no navigation needed: this is the details step)
        checkoutManager.pendingCartError = null;
        if (isSimpleError(e) || isSimpleErrors(e)) {
            showCartError(e instanceof SimpleErrors ? e : new SimpleErrors(e));
        } else {
            errors.errorBox = new ErrorBox(e);
        }
    }
    loading.value = false;
}
</script>
