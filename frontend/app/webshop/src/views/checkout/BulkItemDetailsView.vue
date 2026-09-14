<template>
    <CategorizedView :columns="false" :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" :title="$t('Vul de gegevens aan')" data-testid="details-step" class="bulk-item-details-view" @save="goNext">
        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox v-for="entry of entries" :key="entry.item.id" :title="entry.title" :icon="entry.icon">
            <template #summary>
                <p class="style-description-small">
                    {{ entry.subtitle }}
                </p>
                <p v-for="line of summaryOf(entry.item)" :key="line" class="style-description-small">
                    {{ line }}
                </p>
            </template>

            <div data-testid="details-item">
                <p class="style-description-block">
                    {{ entry.subtitle }}
                </p>

                <STErrorsDefault :error-box="entry.errors.errorBox" />

                <template v-if="entry.item.product.enableCustomer && entry.item.customer">
                    <CustomerInputs :customer="entry.item.customer" :settings="entry.item.product.resolvedCustomerSettings" :name-title="$t('Naam')" :name-autocomplete="false" :radio-group-id="entry.item.id" :error-box="entry.errors.errorBox" :validator="entry.errors.validator" :validate-server="unscopedServer" @change="checkoutManager.saveCart()" />
                    <FillRecordCategoryBox v-if="entry.item.product.resolvedCustomerSettings.recordCategory" :category="entry.item.product.resolvedCustomerSettings.recordCategory" :value="entry.item" :validator="entry.errors.validator" :force-mark-reviewed="true" :hide-title="true" :parent-error-box="entry.errors.errorBox" @patch="patchRecordAnswers(entry.item, $event)" />
                </template>

                <OptionMenuBox v-for="optionMenu in entry.item.product.optionMenus" :key="optionMenu.id" :error-box="entry.errors.errorBox" :cart-item="entry.item" :option-menu="optionMenu" :cart="cart" :old-item="entry.item" :webshop="webshop" />

                <FieldBox v-for="field in entry.item.product.customFields" :key="field.id" :field="field" :answers="entry.item.fieldAnswers" :error-box="entry.errors.errorBox" />

                <template v-if="entry.item.productPrice.uitpasBaseProductPriceId !== null && entry.item.uitpasNumbers[0]">
                    <hr><h3>{{ $t('%wF') }}</h3>
                    <UitpasNumberInput v-model="entry.item.uitpasNumbers[0].uitpasNumber" :placeholder="$t('Geef het UiTPAS-nummer in')" class="max" :validator="entry.errors.validator" :required="true" error-fields="uitpasNumbers.0" :error-box="entry.errors.errorBox" />
                </template>
            </div>
        </CategorizedBox>

        <PriceBreakdownBox v-if="pricedCheckout.priceBreakown.length > 1 || pricedCheckout.totalPrice > 0" :price-breakdown="pricedCheckout.priceBreakown" />
    </CategorizedView>
</template>

<script lang="ts" setup>
import { patchObject } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import UitpasNumberInput from '@stamhoofd/components/inputs/UitpasNumberInput.vue';
import CategorizedBox from '@stamhoofd/components/layout/categorized-view/CategorizedBox.vue';
import CategorizedView from '@stamhoofd/components/layout/categorized-view/CategorizedView.vue';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import OptionMenuBox from '@stamhoofd/components/views/OptionMenuBox.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { CartItem, PatchAnswers } from '@stamhoofd/structures';
import { Customer, ProductType, UitpasNumberAndPrice, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onActivated, reactive, ref, watch } from 'vue';

import { validateUitpasNumbers } from '@stamhoofd/components/views/validateUitpasNumbers.ts';
import { getUnitName } from '../../classes/webshopWording';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { cartItemNeedsDetails, CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

interface ItemErrors {
    errorBox: ErrorBox | null;
    validator: Validator;
    /** Encoded item at the time the error was set: the error disappears once the visitor edits the item */
    snapshot: string | null;
}

const loading = ref(false);
const errors = useErrors();
const owner = useRequestOwner();
const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();
const navigationActions = useNavigationActions();

const webshop = computed(() => webshopManager.webshop);
const cart = computed(() => checkoutManager.cart);
const unscopedServer = computed(() => webshopManager.unscopedServer);

// One error box + validator per item, keyed on the item id so they survive cart changes
const itemErrors = reactive(new Map<string, ItemErrors>());

function errorsFor(item: CartItem): ItemErrors {
    let e = itemErrors.get(item.id);
    if (!e) {
        e = { errorBox: null, validator: new Validator(), snapshot: null };
        itemErrors.set(item.id, e);
    }
    return e;
}


const entries = computed(() => {
    const counters = new Map<string, number>();
    return cart.value.items.filter(i => cartItemNeedsDetails(i)).map((item) => {
        const count = (counters.get(item.product.id) ?? 0) + 1;
        counters.set(item.product.id, count);

        const subtitle: string[] = [item.product.name];
        if (item.product.prices.length > 1) {
            subtitle.push(item.productPrice.name);
        }
        if (item.seats.length > 0) {
            subtitle.push(item.seats.map(s => s.getNameString(webshop.value, item.product)).join(', '));
        }

        return {
            item,
            title: Formatter.capitalizeFirstLetter(getUnitName(webshop.value, item.product).singular) + ' ' + count,
            icon: item.product.type === ProductType.Ticket || item.product.type === ProductType.Voucher ? 'ticket' : (item.product.type === ProductType.Person || item.product.enableCustomer ? 'user' : 'box'),
            subtitle: subtitle.join(' • '),
            errors: errorsFor(item),
        };
    });
});

/**
 * What the visitor filled in so far. Read from the reactive item at render time so the summary column follows the inputs.
 */
function summaryOf(item: CartItem): string[] {
    const summary: string[] = [];
    if (item.customer?.name) {
        summary.push(item.customer.name);
    }
    summary.push(...item.options.map(o => o.option.name));
    summary.push(...item.fieldAnswers.filter(a => a.answer).map(a => a.field.name + ': ' + a.answer));
    summary.push(...item.uitpasNumbers.filter(u => u.uitpasNumber).map(u => $t('%wF') + ': ' + u.uitpasNumber));
    return summary;
}

/**
 * Give every item the objects its inputs bind to, so the template never has to create them while rendering
 */
function prepareItems() {
    for (const item of cart.value.items) {
        if (item.product.enableCustomer && !item.customer) {
            item.customer = Customer.create({});
        }
        if (item.productPrice.uitpasBaseProductPriceId !== null && item.uitpasNumbers.length === 0) {
            item.uitpasNumbers.push(UitpasNumberAndPrice.create({ uitpasNumber: '', price: item.productPrice.price }));
        }
    }
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
            item.validate(webshop.value, cart.value, { refresh: true, validateSeats: true });
            setItemError(entry, null);
        } catch (e) {
            setItemError(entry, e);
            matched = true;
        }
    }

    // Errors that belong to no item (e.g. duplicate UiTPAS numbers across items)
    errors.errorBox = matched ? null : new ErrorBox(error);
}

onActivated(() => {
    const pending = checkoutManager.pendingCartError;
    if (pending) {
        checkoutManager.pendingCartError = null;
        showCartError(pending);
    }
});

async function goNext() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    let valid = true;
    for (const entry of entries.value) {
        if (!await entry.errors.validator.validate()) {
            valid = false;
        }
    }
    if (!valid) {
        loading.value = false;
        return;
    }

    for (const entry of entries.value) {
        const item = entry.item;
        try {
            item.validate(webshop.value, cart.value, { refresh: true, validateSeats: true });
            await validateUitpasNumbers(item, webshopManager.optionalAuthenticatedServer, owner);
            setItemError(entry, null);
        } catch (e) {
            console.error(e);
            setItemError(entry, e);
            valid = false;
        }
    }
    if (!valid) {
        loading.value = false;
        return;
    }

    checkoutManager.saveCart();

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Details, navigationActions);
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

