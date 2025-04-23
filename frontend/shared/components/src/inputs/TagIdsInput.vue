<template>
    <div class="container">
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-if="nullable" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allTags" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('4835dfd4-10b0-4e91-b581-d1b3eefa73f7') }}
                </h3>
            </STListItem>
            <template v-if="model !== null">
                <STListItem v-for="option of options" :key="option.tag.id" :selectable="option.isEnabled && !option.isLocked" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getTagValue(option.tag.id)" :disabled="!option.isEnabled || option.isLocked" @update:model-value="setTagValue(option.tag.id, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ option.tag.name }}
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
import { OrganizationTag } from '@stamhoofd/structures';
import { computed, ref, watch, watchEffect } from 'vue';

const props = withDefaults(
    defineProps<{
        nullable?: boolean;
        isTagEnabledPredicate?: (tag: OrganizationTag) => boolean;
        validator: Validator;
        shouldSelectAtLeastOne?: boolean;
    }>(), {
        nullable: false,
        isTagEnabledPredicate: undefined,
        shouldSelectAtLeastOne: true,
    },
);

const model = defineModel<string[] | null>({ required: true });
const platform = usePlatform();
const errors = useErrors({ validator: props.validator });


const tags = computed(() => platform.value.config.tags);
const lastCachedValue = ref<string[] | null>(null);

watchEffect(() => {
    if (model.value !== null) {
        lastCachedValue.value = model.value;
    }
});

const options = computed(() => {
    const isEnabledOperator = props.isTagEnabledPredicate;

    let result: { tag: OrganizationTag; isEnabled: boolean; isLocked: boolean }[] = [];

    if (isEnabledOperator !== undefined) {
        result = tags.value.map(tag => ({ tag, isEnabled: isEnabledOperator(tag), isLocked: false }));
    }
    else {
        result = tags.value.map(tag => ({ tag, isEnabled: true, isLocked: false }));
    }

    if (result.filter(x => x.isEnabled).length === 1) {
        const firstEnabled = result.find(x => x.isEnabled);
        if (firstEnabled) {
            firstEnabled.isLocked = true;
        }
    }

    return result;
});

useValidation(errors.validator, () => {
    const se = new SimpleErrors();
    if (props.shouldSelectAtLeastOne) {
        if (model.value !== null && model.value.length === 0) {
            se.addError(new SimpleError({
                code: 'invalid_field',
                message: $t('074933d6-e0da-4542-8ec0-efb759645826'),
                field: 'tags',
            }));
        }
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }

    return true;
});

const enabledOptions = computed(() => options.value.filter(t => t.isEnabled).map(t => t.tag.id));

watch(enabledOptions, (options) => {
    if (options.length === 1) {
        if (model.value === null) {
            model.value = [options[0]];
        }
        else if (model.value.length === 0) {
            model.value.push(options[0]);
        }
    }
}, { immediate: true });

const allTags = computed({
    get: () => model.value === null,
    set: (allTags) => {
        if (allTags) {
            model.value = null;
        }
        else {
            model.value = (lastCachedValue.value ?? []).slice();
        }
    },
});

function getTagValue(tag: string) {
    return model.value?.includes(tag) ?? false;
}

function setTagValue(tag: string, value: boolean) {
    if (model.value === null) {
        return;
    }
    if (value) {
        model.value = [...model.value.filter(t => t !== tag), tag];
    }
    else {
        model.value = model.value.filter(t => t !== tag);
    }
}
</script>
