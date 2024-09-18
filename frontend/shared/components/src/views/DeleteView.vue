<template>
    <SaveView :loading="loading" :disabled="disabled" :title="title" :save-text="deleteText" :cancel-text="cancelText" :add-extra-cancel="true" save-icon="trash" save-button-class="destructive" @save="doDelete">
        <h1>{{ title }}</h1>

        <p>{{ description }}</p>

        <STInputBox :title="confirmationTitle" error-fields="confirmationCodeInput">
            <input v-model="confirmationCodeInput" class="input" type="text" :placeholder="confirmationPlaceholder" autocomplete="given-name">
        </STInputBox>

        <hr>

        <STErrorsDefault :error-box="errors.errorBox" />
        <Checkbox v-model="isConfirm" error-fields="isConfirm">
            {{ checkboxText }}
        </Checkbox>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useValidation } from '../errors/useValidation';
import STInputBox from '../inputs/STInputBox.vue';
import { Toast } from '../overlays/Toast';

const props = 
    defineProps<{
        title: string,
        description: string,
        confirmationTitle: string,
        confirmationPlaceholder: string,
        confirmationCode: string,
        checkboxText: string
        onDelete: () => Promise<boolean>
    }>();

const pop = usePop();
const errors = useErrors();

const deleteText = 'Verwijderen';
const cancelText = 'Annuleren';
const confirmationCodeInput = ref('');
const isConfirm = ref(false);
const disabled = computed(() => confirmationCodeInput.value.toLowerCase() !== props.confirmationCode.toLowerCase());
const loading = ref(false);

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

    if (!isConfirm.value) {
        se.addError(new SimpleError({
            code: "invalid_field",
            message: "Bevestig de actie",
            field: "isConfirm"
        }))
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }

    errors.errorBox = null;
    return true;
});

async function doDelete() {
    if(disabled.value) {
        return;
    }

    loading.value = true;

    try {
        const isValid = await errors.validator.validate();

        if(!isValid) {
            return;
        }

        const isDeleted = await props.onDelete();

        if(isDeleted) {
            await pop();
        }
    } catch(e) {
        Toast.fromError(e).show();
    } finally {
        loading.value = false;
    }
}
</script>
