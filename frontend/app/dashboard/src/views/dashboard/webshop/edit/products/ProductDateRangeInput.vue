<template>
    <div>
        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`5eb46bbe-816e-4c92-9bde-09777c924326`)">
                <DateSelection v-model="startDate"/>
            </STInputBox>
            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t(`4b331768-4947-4cb8-8eff-b2b3eb7c2994`)"/>
        </div>
        <div class="split-inputs">
            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`f8aa75e4-d41f-4264-a273-8ac100dfd543`)">
                <DateSelection v-model="endDate"/>
            </STInputBox>
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`705ffb6b-d853-48fa-8672-22532471e2fb`)"/>
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
