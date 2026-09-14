<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :title="$t(`%uE`)" data-testid="customer-step" @save="goNext">
        <h1>{{ $t('%uE') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <CustomerInputs :customer="checkoutManager.checkout.customer" :settings="fieldSettings" :show-name="!isLoggedIn" :error-box="errors.errorBox" :validator="errors.validator" :validate-server="unscopedServer" :email-placeholder="emailPlaceholder" :email-description="emailDescription" @change="checkoutManager.saveCheckout()" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import type { CustomerFieldSettings } from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import { WebshopTicketType } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';

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

const fieldSettings = computed((): CustomerFieldSettings => {
    const toRequirement = (enabled: boolean) => enabled ? CustomerFieldRequirement.Required : CustomerFieldRequirement.Disabled;
    return {
        email: isLoggedIn.value ? CustomerFieldRequirement.Disabled : CustomerFieldRequirement.Required,
        phone: toRequirement(webshop.value.meta.phoneEnabled),
        birthDay: toRequirement(webshop.value.meta.birthDayEnabled),
        gender: toRequirement(webshop.value.meta.genderEnabled),
        address: toRequirement(webshop.value.meta.addressEnabled && !hasDeliveryAddress.value),
    };
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
