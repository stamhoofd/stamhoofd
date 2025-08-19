<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" data-submit-last-field :title="$t(`1db407ec-4d25-40f9-92b9-abf820faaf98`)" @save="goNext">
        <h1>{{ $t('38bea62e-0765-4fbf-a6f3-4e21cc4cc2ef') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!isLoggedIn">
            <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`f50f1057-e8a0-472e-ae14-2f393f79db53`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" required autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" required autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" name="email" :validator="errors.validator" :placeholder="emailPlaceholder" autocomplete="email" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="phoneEnabled" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34' )" name="mobile" :validator="errors.validator" autocomplete="tel" :placeholder="$t(`d72f4e7e-91b8-4edf-82a7-35c97c4498af`)" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { EmailInput, ErrorBox, FieldBox, PhoneInput, SaveView, STErrorsDefault, STInputBox, useContext, useErrors, useNavigationActions } from '@stamhoofd/components';
import { WebshopTicketType } from '@stamhoofd/structures';

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
const phoneEnabled = computed(() => webshop.value.meta.phoneEnabled);
const isLoggedIn = computed(() => context.value.isComplete() ?? false);

const emailPlaceholder = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('E-mailadres om je tickets te ontvangen');
    }
    return $t('E-mailadres om je bevestigingsemail te ontvangen');
});

const emailDescription = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return $t('Je ontvangt jouw tickets op dit e-mailadres. Kijk het goed na.');
    }
    return null;
});

const fields = computed(() => webshop.value.meta.customFields);

const firstName = computed({
    get: () => checkoutManager.checkout.customer.firstName,
    set: (firstName: string) => {
        checkoutManager.checkout.customer.firstName = firstName;
        checkoutManager.saveCheckout();
    },
});

const lastName = computed({
    get: () => checkoutManager.checkout.customer.lastName,
    set: (lastName: string) => {
        checkoutManager.checkout.customer.lastName = lastName;
        checkoutManager.saveCheckout();
    },
});

const email = computed({
    get: () => checkoutManager.checkout.customer.email,
    set: (email: string) => {
        checkoutManager.checkout.customer.email = email;
        checkoutManager.saveCheckout();
    },
});

const phone = computed({
    get: () => checkoutManager.checkout.customer.phone,
    set: (phone: string) => {
        checkoutManager.checkout.customer.phone = phone;
        checkoutManager.saveCheckout();
    },
});

async function goNext() {
    if (loading.value) {
        return;
    }

    if (!await errors.validator.validate()) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;

    // Clear old open fields

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
