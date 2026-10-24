<template>
    <SaveView save-icon-right="arrow-right" :save-text="$t('%16p')" :title="$t('%uE')" @save="save">
        <h1>{{ $t('%uE') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <CustomerInputs :customer="checkout.customer" :settings="webshop.meta.customerSettings" :error-box="errors.errorBox" :validator="errors.validator" />
        <FillRecordCategoryBox v-if="recordCategory" :category="recordCategory" :value="checkout" :validator="errors.validator" :force-mark-reviewed="true" :hide-title="true" :parent-error-box="errors.errorBox" @patch="patchRecordAnswers" />
        <FieldBox v-for="field in webshop.meta.customFields" :key="field.id" :with-title="false" :field="field" :answers="checkout.fieldAnswers" :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { patchObject } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import CustomerInputs from '@stamhoofd/components/views/CustomerInputs.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import type { PatchAnswers, PrivateWebshop } from '@stamhoofd/structures';
import { Checkout } from '@stamhoofd/structures';
import { computed, reactive } from 'vue';

/**
 * Shows the contact person step of the checkout like it appears in the webshop
 */
const props = defineProps<{
    webshop: PrivateWebshop;
}>();

const errors = useErrors();
const pop = usePop();
const checkout = reactive(Checkout.create({})) as Checkout;
const recordCategory = computed(() => props.webshop.meta.customerSettings.recordCategory);

function patchRecordAnswers(patch: PatchAnswers) {
    checkout.recordAnswers = patchObject(checkout.recordAnswers, patch);
}

async function save() {
    // Inputs may throw their validation error instead of returning false
    try {
        if (!await errors.validator.validate()) {
            return;
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
        return;
    }
    await pop({ force: true });
}
</script>
