<template>
    <MultipleChoiceInput
        v-model="model"
        :items="defaultAgeGroups.map(group => ({ name: group.name, value: group.id }))"
        :nullable="nullable"
        :nullable-label="$t('%52')"
    />
</template>

<script setup lang="ts">
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useValidation } from '#errors/useValidation.ts';
import { Validator } from '#errors/Validator.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { computed } from 'vue';
import MultipleChoiceInput from './MultipleChoiceInput.vue';

const props = withDefaults(
    defineProps<{
        nullable?: boolean;
        validator: Validator;
        shouldSelectAtLeastOne?: boolean;
    }>(), {
        nullable: false,
        shouldSelectAtLeastOne: true,
    },
);

const model = defineModel<string[] | null>({ required: true });
const platform = usePlatform();
const errors = useErrors({ validator: props.validator });

const defaultAgeGroups = computed(() => platform.value.config.defaultAgeGroups);

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (props.shouldSelectAtLeastOne) {
        if (model.value !== null && model.value.length === 0) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t('%DW'),
                field: 'agegroups',
            }));
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }

    return true;
});
</script>
