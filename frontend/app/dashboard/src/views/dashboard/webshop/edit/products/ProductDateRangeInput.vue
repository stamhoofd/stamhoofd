<template>
    <div>
        <div class="split-inputs">
            <STInputBox error-fields="startDate" :error-box="errors.errorBox" :title="$t(`%7e`)">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t(`%U4`)" />
        </div>
        <div class="split-inputs">
            <STInputBox error-fields="endDate" :error-box="errors.errorBox" :title="$t(`%wB`)">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t(`%5L`)" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useValidation } from '@stamhoofd/components/errors/useValidation.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import type { ProductDateRange } from '@stamhoofd/structures';
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
