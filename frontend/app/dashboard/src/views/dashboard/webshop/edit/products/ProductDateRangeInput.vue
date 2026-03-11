<template>
    <div>
        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`300d2935-b578-48cc-b58e-1c0446a68d59`)">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t(`eb8ecd08-c062-41e1-8e60-27cdf9a4f269`)" />
        </div>
        <div class="split-inputs">
            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`3c90169c-9776-4d40-bda0-dba27a5bad69`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`1617abfe-8657-4a9f-9fe3-6e6d896c4ef6`)" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { DateSelection, ErrorBox, STInputBox, TimeInput, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { ProductDateRange } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{ validator?: Validator | null }>(), {
    // Assign a validator if you want to offload the validation to components
    validator: null,
});

const errors = useErrors({
    validator: props.validator });

const model = defineModel<ProductDateRange | null>({ default: null });

if (props.validator) {
    useValidation(props.validator, async () => {
        return await isValid();
    });
}

const startDate = computed({
    get: () => model.value?.startDate ?? new Date(),
    set: (startDate: Date) => {
        if (model.value) {
            model.value = model.value.patch({ startDate });
        }
    },
});

const endDate = computed({
    get: () => model.value?.endDate ?? new Date(),
    set: (endDate: Date) => {
        if (model.value) {
            model.value = model.value.patch({ endDate });
        }
    },
});

async function isValid(): Promise<boolean> {
    await Promise.resolve();
    if (startDate.value > endDate.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            field: 'endDate',
            message: 'De einddatum en tijdstip die je hebt ingevuld ligt voor de startdatum en tijdstip',
        }));
        return false;
    }

    return true;
}
</script>
