<template>
    <SaveView :loading="loading" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :title="$t(`%uE`)" @save="goNext">
        <h1>{{ $t('%uE') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!isLoggedIn">
            <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%Uy`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" required autocomplete="given-name" :placeholder="$t(`%1MT`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" required autocomplete="family-name" :placeholder="$t(`%1MU`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" name="email" :validator="errors.validator" :placeholder="emailPlaceholder" autocomplete="email" :title="$t(`%1FK`)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />
        </template>

        <PhoneInput v-if="phoneEnabled" v-model="phone" :title="$t('%2k' )" name="mobile" :validator="errors.validator" autocomplete="tel" :placeholder="$t(`%Xu`)" />

        <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import PhoneInput from '@stamhoofd/components/inputs/PhoneInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
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
