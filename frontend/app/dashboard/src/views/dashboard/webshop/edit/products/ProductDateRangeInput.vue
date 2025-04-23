<template>
    <div>
        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`33a674c2-6981-442b-9bd4-01f71da7a159`)">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t(`eb8ecd08-c062-41e1-8e60-27cdf9a4f269`)" />
        </div>
        <div class="split-inputs">
            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`f852932e-380e-4b9a-916b-2bc008d8c08a`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`d79d562c-022a-4502-bc96-88704f68d583`)" />
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
    value: null,
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
