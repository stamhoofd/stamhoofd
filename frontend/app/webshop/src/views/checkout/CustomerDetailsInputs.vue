<template>
    <CustomerInputs :customer="checkoutManager.checkout.customer" :settings="settings" :error-box="errorBox" :validator="validator" :email-placeholder="emailPlaceholder" :email-description="emailDescription" @change="checkoutManager.saveCheckout()" />

    <FillRecordCategoryBox v-if="recordCategory" :category="recordCategory" :value="checkoutManager.checkout" :validator="validator" :force-mark-reviewed="true" :hide-title="true" :parent-error-box="errorBox" @patch="patchRecordAnswers" />

    <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="checkoutManager.checkout.fieldAnswers" :error-box="errorBox" />
</template>

<script lang="ts" setup>
import { patchObject } from '@simonbackx/simple-encoding';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import type { PatchAnswers } from '@stamhoofd/structures';
import type { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { computed } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';

/**
 * The details of the order's contact person that still have to be filled in
 */
defineProps<{
    settings: CustomerSettings;
    errorBox: ErrorBox | null;
    validator: Validator;
    emailPlaceholder: string;
    emailDescription: string | null;
}>();

const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();

const fields = computed(() => webshopManager.webshop.meta.customFields);
const recordCategory = computed(() => webshopManager.webshop.meta.customerSettings.recordCategory);

function patchRecordAnswers(patch: PatchAnswers) {
    checkoutManager.checkout.recordAnswers = patchObject(checkoutManager.checkout.recordAnswers, patch);
    checkoutManager.saveCheckout();
}
</script>
