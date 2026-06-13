<template>
    <div class="property-filter-value-input">
        <STInputBox v-if="!isAlwaysEnabled() || hasFilters" class="max" :title="$t(`%bZ`)">
            <STList>
                <STListItem v-if="!required" :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="null" @update:model-value="setDisabled()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ disabledText || $t('%1Io') }}
                    </h3>
                    <p v-if="disabledDescription" class="style-description-small">
                        {{ disabledDescription }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="true" @update:model-value="setAlwaysEnabled()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%bW') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isDisabled() === true ? null : isAlwaysEnabled()" :value="false" @update:model-value="setEnabledWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%bX') }}
                    </h3>
                    <p class="style-description-small">
                        {{ enabledText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysEnabled()" class="button text" type="button" @click="setEnabledWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">{{ $t('%1Bm') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>

        <STInputBox v-if="modelValue && allowOptional" class="max" :title="$t(`%ba`) + '*'">
            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isAlwaysRequired()" :value="true" @update:model-value="setAlwaysRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1Ip') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="isNeverRequired()" :value="true" @update:model-value="setNeverRequired()" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1Iq') }}
                    </h3>
                </STListItem>

                <STListItem v-if="hasFilters || (!isAlwaysRequired() && !isNeverRequired())" :selectable="true" element-name="label">
                    <template #left>
                        <Radio :model-value="!isAlwaysRequired() && !isNeverRequired()" :value="true" @update:model-value="setRequiredWhen(true)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%bX') }}
                    </h3>
                    <p class="style-description-small">
                        {{ requiredText }}
                    </p>
                    <template #right>
                        <button v-if="!isAlwaysRequired() && !isNeverRequired()" class="button text" type="button" @click="setRequiredWhen(false)">
                            <span class="icon edit" />
                            <span class="hide-small">{{ $t('%1Bm') }}</span>
                        </button>
                    </template>
                </STListItem>
            </STList>
        </STInputBox>
        <p v-if="allowOptional" class="style-description-small">
            * {{ $t("%bY") }}
        </p>

        <div v-if="isDevelopment">
            <code class="style-code">
                {{ encodedJson }}
            </code>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { isEmptyFilter, PropertyFilter, Version } from '@stamhoofd/structures';
import { computed, onMounted, shallowRef } from 'vue';

import Radio from '../inputs/Radio.vue';
import STInputBox from '../inputs/STInputBox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import type { UIFilter, UIFilterBuilder } from './UIFilter';
import { filterToString } from './UIFilter';
import UIFilterEditor from './UIFilterEditor.vue';

const model = defineModel<PropertyFilter | null>({ required: true });
const props = withDefaults(defineProps<{
    required?: boolean;
    disabledText?: string;
    disabledDescription?: string;
    allowOptional?: boolean;
    builder: UIFilterBuilder;
}>(), {
    required: true,
    disabledText: '',
    disabledDescription: '',
    allowOptional: true,
});

const present = usePresent();
const cachedRequiredFilter = shallowRef<StamhoofdFilter | null>(null);
const cachedEnabledFilter = shallowRef<StamhoofdFilter | null>(null);
const hasFilters = computed(() => props.builder instanceof GroupUIFilterBuilder && props.builder.builders.length > 1);
const isDevelopment = STAMHOOFD.environment === 'development';
const encodedJson = computed(() => model.value === null ? 'null' : JSON.stringify(model.value.encode({ version: Version }), null, 4));
const enabledText = computed(() => model.value?.enabledWhen ? filterToString(model.value.enabledWhen, props.builder) : '');
const requiredText = computed(() => !model.value || isEmptyFilter(model.value.requiredWhen) ? '' : filterToString(model.value.requiredWhen, props.builder));

onMounted(cacheIfNeeded);

function isAlwaysEnabled() {
    if (model.value === null) {
        return false;
    }
    return model.value.enabledWhen === null || isEmptyFilter(model.value.enabledWhen);
}

function isAlwaysRequired() {
    if (model.value === null) {
        return false;
    }
    return model.value.requiredWhen !== null && isEmptyFilter(model.value.requiredWhen);
}

function isNeverRequired() {
    if (model.value === null) {
        return true;
    }
    return model.value.requiredWhen === null;
}

function cacheIfNeeded() {
    if (!model.value) {
        return;
    }
    if (model.value.requiredWhen && !isEmptyFilter(model.value.requiredWhen)) {
        cachedRequiredFilter.value = model.value.requiredWhen;
    }
    if (model.value.enabledWhen && !isEmptyFilter(model.value.enabledWhen)) {
        cachedEnabledFilter.value = model.value.enabledWhen;
    }
}

function setAlwaysEnabled() {
    model.value = new PropertyFilter(null, model.value?.requiredWhen ?? {});
}

function isDisabled() {
    return model.value === null;
}

function setDisabled() {
    model.value = null;
}

async function setEnabledWhen(useCache = false) {
    if (useCache && cachedEnabledFilter.value && !isEmptyFilter(cachedEnabledFilter.value)) {
        model.value = new PropertyFilter(cachedEnabledFilter.value, model.value?.requiredWhen ?? {});
        return;
    }

    const filter = model.value?.enabledWhen ? props.builder.fromFilter(model.value.enabledWhen) : props.builder.create();
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                    saveHandler: (filter: UIFilter) => {
                        cachedEnabledFilter.value = filter.build();
                        model.value = new PropertyFilter(cachedEnabledFilter.value, model.value?.requiredWhen ?? {});
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

function setAlwaysRequired() {
    model.value = new PropertyFilter(model.value?.enabledWhen ?? null, {});
}

function setNeverRequired() {
    model.value = new PropertyFilter(model.value?.enabledWhen ?? null, null);
}

async function setRequiredWhen(useCache = false) {
    if (useCache && cachedRequiredFilter.value && !isEmptyFilter(cachedRequiredFilter.value)) {
        model.value = new PropertyFilter(model.value?.enabledWhen ?? null, cachedRequiredFilter.value);
        return;
    }

    const filter = !model.value || isEmptyFilter(model.value.requiredWhen)
        ? props.builder.create()
        : props.builder.fromFilter(model.value.requiredWhen);

    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                    saveHandler: (filter: UIFilter) => {
                        cachedRequiredFilter.value = filter.build();
                        model.value = new PropertyFilter(model.value?.enabledWhen ?? null, cachedRequiredFilter.value);
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}
</script>
