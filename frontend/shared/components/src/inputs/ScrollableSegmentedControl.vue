<template>
    <div ref="rootElement" class="scrollable-segmented-control">
        <button
            v-for="(item, index) in items"
            :key="index"
            ref="elements"
            class="button item"
            type="button"
            :class="{ selected: item == modelValue }"
            @click="selectItem(index)"
        >
            <span>{{ labels ? labels[index] : item }}</span>
        </button>

        <div class="right">
            <slot name="right" />
        </div>

        <div class="seeker" :style="{'--seek-width': seekerWidth+'px', '--seek-x': seekerXOffset + 'px'}" />
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { useResizeObserver } from './hooks/useResizeObserver';


const props = withDefaults(
    defineProps<{items: any[], labels?: string[] | null}>(),
    {labels: null}
);
const modelValue = defineModel<any>();
const elements = ref<HTMLElement[]>([]);
const rootElement = ref<HTMLElement | null>(null);

const widths = ref<number[]>([]);
const seekerXOffset = computed(() => {
    if (modelValue.value == null) {
        return 0;
    }
    const index = props.items.indexOf(modelValue.value);
    if (index === -1) {
        return 0;
    }
    return widths.value.slice(0, index).reduce((a, b) => a + b, 0) + (30 * index);
});
const seekerWidth = computed(() => {
    if (modelValue.value == null) {
        return 0;
    }
    return widths.value[props.items.indexOf(modelValue.value)] ?? 0;
});

function selectItem(index: number) {
    modelValue.value = props.items[index];
}

function updateWidths() {
    widths.value = elements.value.map(e => (e.offsetWidth ));
}

onMounted(() => {
    updateWidths();
});

useResizeObserver(rootElement, () => {
    updateWidths();
});

watch(() => props.labels, async () => {
    // Wait for next render
    await nextTick();
    updateWidths();
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';
$segmented-control-height: 60px;

.scrollable-segmented-control {
    margin: var(--st-hr-margin, 30px) calc(-1 * var(--st-horizontal-padding, 40px));
    padding: 0 var(--st-horizontal-padding, 40px);

    h1 + & {
        margin-top: 0px;
    }
    
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    flex-direction: row;
    position: relative;
    --seek-x: 0px;
    --seek-width: 100px;
    scrollbar-width: thin;

    &:before {
        content: '';
        position: absolute;
        background: $color-border;
        left: 0;
        right: 0;
        bottom: 0;
        height: $border-width-thin;
    }

    > .seeker {
        position: absolute;
        background: $color-primary;
        left: var(--st-horizontal-padding, 40px);
        bottom: 0;
        height: 3px;
        transition: width 0.2s, transform 0.2s, opacity 0.2s;
        
        width: var(--seek-width);
        transform: translateX(var(--seek-x));
        border-radius: 1.5px;
    }

    > .item {
        height: $segmented-control-height;
        min-width: 0;
        flex-shrink: 0;
        max-width: 30vw;
        @extend .style-interactive-small;
        border-bottom: 3px solid transparent;
        line-height: $segmented-control-height;
        transition: color 0.2s, opacity 0.2s;
        margin: 0 15px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:first-child {
            margin-left: 0;
        }

        &:active, &:hover {
            opacity: 0.4;
        }

        &.selected {
            color: $color-primary;

            &:hover ~ .seeker {
                opacity: 0.4;
            }
        }
    }

    > .right {
        margin-left: auto;
        height: $segmented-control-height;
        display: flex;
        align-items: center;
    }
}
</style>
