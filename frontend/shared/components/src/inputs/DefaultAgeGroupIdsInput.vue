<template>
    <MultipleChoiceInput
        v-model="model"
        :items="defaultAgeGroups.map(group => ({ name: group.name, value: group.id }))"
        :nullable="nullable"
        :nullable-label="$t('07d642d2-d04a-4d96-b155-8dbdb1a9e4ff')"
    />
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ErrorBox, useErrors, usePlatform, useValidation, Validator } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
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
const $t = useTranslate();

const defaultAgeGroups = computed(() => platform.value.config.defaultAgeGroups);

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (props.shouldSelectAtLeastOne) {
        if (model.value !== null && model.value.length === 0) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t('Kies minstens één standaard leeftijdsgroep'),
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
