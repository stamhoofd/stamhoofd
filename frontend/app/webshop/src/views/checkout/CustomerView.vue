<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :title="$t(`%uE`)" data-testid="customer-step" @save="goNext">
        <h1>{{ $t('%uE') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="itemsWithCustomer.length > 0 && !isLoggedIn">
            <p class="style-description-block">
                {{ $t('Wie is de contactpersoon voor deze bestelling?') }}
            </p>
            <STList class="customer-selection-list" data-testid="main-customer-list">
                <STListItem v-for="item of itemsWithCustomer" :key="item.id" :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio :model-value="selectedItemId" :value="item.id" name="main-customer" @update:model-value="selectItemCustomer(item)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ item.customer!.name }}
                    </h3>
                    <p class="style-description-small">
                        {{ item.product.name }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio :model-value="selectedItemId" value="" name="main-customer" @update:model-value="selectOtherCustomer" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('Iemand anders') }}
                    </h3>
                </STListItem>
            </STList>
            <hr>
        </template>

        <CustomerInputs :customer="checkoutManager.checkout.customer" :settings="fieldSettings" :show-name="!isLoggedIn" :error-box="errors.errorBox" :validator="errors.validator" :validate-server="unscopedServer" :email-placeholder="emailPlaceholder" :email-description="emailDescription" @change="checkoutManager.saveCheckout()" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import type { CartItem } from '@stamhoofd/structures';
import { Customer, WebshopTicketType } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const context = useContext();
const webshop = computed(() => webshopManager.webshop);
const navigationActions = useNavigationActions();
const isLoggedIn = computed(() => context.value.isComplete() ?? false);
const unscopedServer = computed(() => webshopManager.unscopedServer);

// When a delivery method is chosen, its address is already collected in a separate step
// and stored on the customer, so we don't ask for the address a second time.
const hasDeliveryAddress = computed(() => checkoutManager.checkout.deliveryMethod !== null);

const fieldSettings = computed((): CustomerSettings => {
    const settings = webshop.value.meta.customerSettings;
    return settings.patch({
        // A logged in user's name and email address come from their account
        email: isLoggedIn.value ? CustomerFieldRequirement.Disabled : settings.email,
        address: hasDeliveryAddress.value ? CustomerFieldRequirement.Disabled : settings.address,
    });
});

const emailPlaceholder = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('%1Dk');
    }
    return $t('%1Dl');
});

const emailDescription = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('%1Dm');
    }
    return null;
});

const fields = computed(() => webshop.value.meta.customFields);

const itemsWithCustomer = computed(() => checkoutManager.cart.items.filter(i => i.customer !== null));

// Derived: editing the prefilled name switches back to "someone else"
const selectedItemId = computed(() => {
    const customer = checkoutManager.checkout.customer;
    return itemsWithCustomer.value.find(i => i.customer!.firstName === customer.firstName && i.customer!.lastName === customer.lastName)?.id ?? '';
});

function selectItemCustomer(item: CartItem) {
    const source = item.customer!;
    const customer = checkoutManager.checkout.customer;
    customer.firstName = source.firstName;
    customer.lastName = source.lastName;
    // Only overwrite what the item collected: the rest stays for the order-level inputs
    if (source.email) {
        customer.email = source.email;
    }
    if (source.phone) {
        customer.phone = source.phone;
    }
    if (source.birthDay) {
        customer.birthDay = source.birthDay;
    }
    if (source.address) {
        customer.address = source.address;
    }
    if (item.product.resolvedCustomerSettings.gender !== CustomerFieldRequirement.Disabled) {
        customer.gender = source.gender;
    }
    checkoutManager.saveCheckout();
}

function selectOtherCustomer() {
    checkoutManager.checkout.customer = Customer.create({});
    checkoutManager.saveCheckout();
}

async function goNext() {
    if (loading.value) {
        return;
    }

    if (!await errors.validator.validate()) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    try {
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Customer, navigationActions);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
