<template>
    <div>
        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="startDate" :error-box="errors.errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" title="Vanaf welk tijdstip" :validator="errors.validator" />
        </div>
        <div class="split-inputs">
            <STInputBox title="Einddatum" error-fields="endDate" :error-box="errors.errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="errors.validator" />
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
