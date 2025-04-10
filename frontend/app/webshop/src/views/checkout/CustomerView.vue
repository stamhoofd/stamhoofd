<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('Doorgaan')" data-submit-last-field :title="$t(`Jouw gegevens`)" @save="goNext">
        <h1>{{ $t('Jouw gegevens') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!isLoggedIn">
            <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`Jouw naam`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" required autocomplete="given-name" :placeholder="$t(`Voornaam`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" required autocomplete="family-name" :placeholder="$t(`Achternaam`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" name="email" :validator="errors.validator" :placeholder="emailPlaceholder" autocomplete="email" :title="$t(`E-mailadres`)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="phoneEnabled" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34' )" name="mobile" :validator="errors.validator" autocomplete="tel" :placeholder="$t(`Voor dringende info`)" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { EmailInput, ErrorBox, FieldBox, PhoneInput, SaveView, STErrorsDefault, STInputBox, useContext, useErrors } from '@stamhoofd/components';
import { WebshopTicketType } from '@stamhoofd/structures';

import { useDismiss, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { CheckoutStepsManager, CheckoutStepType } from './CheckoutStepsManager';

const loading = ref(false);
const errors = useErrors();

const webshopManager = useWebshopManager();
const checkoutManager = useCheckoutManager();
const navigationController = useNavigationController();
const dismiss = useDismiss();
const show = useShow();
const context = useContext();
const webshop = computed(() => webshopManager.webshop);

const phoneEnabled = computed(() => webshop.value.meta.phoneEnabled);
const isLoggedIn = computed(() => context.value.isComplete() ?? false);

const emailPlaceholder = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return 'Voor tickets';
    }
    return 'Voor bevestigingsemail';
});

const emailDescription = computed(() => {
    if (webshop.value.meta.ticketType !== WebshopTicketType.None) {
        return 'Je ontvangt jouw tickets op dit e-mailadres. Kijk het goed na.';
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
        await CheckoutStepsManager.for(checkoutManager).goNext(CheckoutStepType.Customer, {
            navigationController: navigationController.value,
            dismiss,
            show,
        });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
