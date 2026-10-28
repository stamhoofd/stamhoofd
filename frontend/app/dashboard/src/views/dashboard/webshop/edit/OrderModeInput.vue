<template>
    <STList class="order-mode-input">
        <STListItem v-for="option of sortedOptions" :key="option.mode" :selectable="true" element-name="label" class="left-center" :data-testid="option.testId">
            <template #left>
                <Radio v-model="model" :value="option.mode" />
            </template>

            <h3 class="style-title-list">
                {{ getWebshopOrderModeName(option.mode, meta) }}
            </h3>
            <p class="style-description-small">
                {{ option.description }}
            </p>

            <!-- Skeletons of what visitors see on the start page of the webshop. The selected option turns them a bit bluer. -->
            <template #right>
                <svg v-if="option.mode === WebshopOrderMode.Cart" viewBox="0 0 80 48" aria-hidden="true">
                    <rect class="highlight" x="0" y="0" width="37" height="21" rx="4" />
                    <rect x="43" y="0" width="37" height="21" rx="4" />
                    <rect x="0" y="27" width="37" height="21" rx="4" />
                    <rect x="43" y="27" width="37" height="21" rx="4" />
                </svg>

                <svg v-else-if="option.mode === WebshopOrderMode.Bulk" viewBox="0 0 80 48" aria-hidden="true">
                    <template v-for="(y, i) of [0, 18, 36]" :key="y">
                        <rect :y="y + 3" width="36" height="6" rx="3" />
                        <rect :class="{ highlight: i === 0 }" x="56" :y="y" width="24" height="12" rx="6" />
                    </template>
                </svg>

                <svg v-else viewBox="0 0 80 48" aria-hidden="true">
                    <template v-for="(y, i) of [0, 18, 36]" :key="y">
                        <circle :class="{ highlight: i === 0 }" cx="6" :cy="y + 6" r="6" />
                        <rect x="18" :y="y + 3" :width="[44, 32, 38][i]" height="6" rx="3" />
                    </template>
                </svg>
            </template>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import type { WebshopMetaData } from '@stamhoofd/structures';
import { getWebshopOrderModeName, WebshopOrderMode } from '@stamhoofd/structures';
import { computed } from 'vue';
import { prefersBulkOrderMode } from './orderModeOptions';

const model = defineModel<WebshopOrderMode>({ required: true });

const props = defineProps<{
    /** The names and the order of the modes follow the type of the webshop */
    meta: WebshopMetaData;
    showSingle: boolean;
}>();

const options = [
    {
        mode: WebshopOrderMode.Cart,
        testId: 'order-mode-cart',
        description: $t('%a02'),
    },
    {
        mode: WebshopOrderMode.Bulk,
        testId: 'order-mode-bulk',
        description: $t('%Zyz'),
    },
    {
        mode: WebshopOrderMode.Single,
        testId: 'order-mode-single',
        description: $t('%ZzE'),
    },
];

const sortedOptions = computed(() => {
    const visible = options.filter(o => props.showSingle || o.mode !== WebshopOrderMode.Single);
    if (!prefersBulkOrderMode(props.meta.type)) {
        return visible;
    }
    return [...visible.filter(o => o.mode !== WebshopOrderMode.Cart), ...visible.filter(o => o.mode === WebshopOrderMode.Cart)];
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.order-mode-input {
    svg {
        display: block;
        width: 64px;
        height: auto;
        margin-left: 15px;
        fill: $color-background-shade-darker;
    }

    // Selected: a slightly bluer gray, no primary color
    .st-list-item:has(input:checked) svg {
        fill: $color-primary-background;

        .highlight {
            fill: $color-primary-light;
        }
    }
}
</style>
