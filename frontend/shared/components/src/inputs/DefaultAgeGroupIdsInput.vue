<template>
    <div class="container">
        <STErrorsDefault :error-box="errors.errorBox" />
        <STList>
            <STListItem v-if="nullable" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allGroups" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('07d642d2-d04a-4d96-b155-8dbdb1a9e4ff') }}
                </h3>
            </STListItem>
            <template v-if="model !== null">
                <STListItem v-for="group of defaultAgeGroups" :key="group.id" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getGroupValue(group.id)" @update:model-value="setGroupValue(group.id, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ group.name }}
                    </h3>
                </STListItem>
            </template>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ErrorBox, useErrors, usePlatform, useValidation, Validator } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { computed, ref, watchEffect } from 'vue';

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
const lastCachedValue = ref<string[] | null>(null);

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
});

const allGroups = computed({
    get: () => model.value === null,
    set: (allGroups) => {
        if (allGroups) {
            model.value = null;
        }
        else {
            model.value = (lastCachedValue.value ?? []).slice();
        }
    },
});

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

function getGroupValue(group: string) {
    return model.value?.includes(group) ?? false;
}

function setGroupValue(group: string, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t !== group), group];
    }
    else {
        model.value = model.value.filter(t => t !== group);
    }
}
</script>
