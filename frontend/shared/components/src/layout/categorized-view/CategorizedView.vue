<template>
    <SaveView v-bind="attrs" class="shade categorized-view" main-class="split">
        <div ref="summary" class="summary container">
            <h1>
                {{ title }}
            </h1>

            <div ref="seeker-box" class="seeker-box">
                <STList>
                    <STListItem v-for="(category, index) of categories" :key="index" ref="categoryRows" :selectable="true" class="no-border" @click="scrollToCategory(category)">
                        <template #left>
                            <span :class="'icon ' + category.icon.value" />
                        </template>
                        <h2 class="style-title-list">
                            {{ category.title.value }}
                        </h2>

                        <RenderSummary :category="category" />

                        <template v-if="category.hasError?.value" #right>
                            <span class="icon error red" />
                        </template>
                    </STListItem>
                </STList>

                <div v-if="seekerHeight" class="seeker" :style="{'--seek-height': seekerHeight+'px', '--seek-y': seekeryOffset + 'px'}" />
            </div>
        </div>
        <div>
            <slot />
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { Sorter } from '@stamhoofd/utility';
import { defineComponent, ref, Ref, useTemplateRef, watch } from 'vue';
import { ViewportHelper } from '../../ViewportHelper';
import SaveView from '../../navigation/SaveView.vue';
import { SaveViewDefaults, SaveViewProps } from '../../navigation/SaveViewProps';
import STList from '../STList.vue';
import STListItem from '../STListItem.vue';
import { CategorizedViewCategory } from './CategorizedViewCategory';
import { useScrollListener } from '../../hooks';

const attrs = withDefaults(
    defineProps<SaveViewProps>(),
    SaveViewDefaults,
);

const categories = ref([]) as Ref<CategorizedViewCategory[]>;
const visibleCategories = ref([]) as Ref<CategorizedViewCategory[]>;
const summaryElement = useTemplateRef('summary');
const categoryRows = useTemplateRef('categoryRows');

const seekerHeight = ref(0);
const seekeryOffset = ref(0);

function getScrollElement() {
    return summaryElement.value?.closest('main');
}

const scrollElement = ref(null) as Ref<HTMLElement | null>;
watch(summaryElement, () => {
    scrollElement.value = getScrollElement() ?? null;
});

useScrollListener(scrollElement, () => {
    console.log('did scroll');

    const scrollEl = scrollElement.value;
    if (!scrollEl) {
        return;
    }

    const scrollRect = scrollEl.getBoundingClientRect();

    if (scrollRect.height === 0) {
        return;
    }

    let filtered: CategorizedViewCategory[] = [];
    let requiredPercentage = 0.90;

    for (const category of categories.value) {
        const box = category.el.value;
        if (!box) {
            continue;
        }

        // todo: cache dimensions and offset of all category elements
        // getBoundingClientRect is very expensive
        const rect = box.getBoundingClientRect();
        if (rect.top > scrollRect.bottom) {
            // Not visible
            continue;
        }

        if (rect.bottom < scrollRect.top) {
            // Not visible
            continue;
        }

        const start = Math.max(rect.top, scrollRect.top);
        const end = Math.min(rect.bottom, scrollRect.bottom);
        const visibleHeight = end - start;
        const percentage = Math.max(visibleHeight / (scrollRect.height), visibleHeight / rect.height);

        console.log(category.title.value, percentage, visibleHeight, scrollRect.height);

        if (percentage > requiredPercentage) {
            requiredPercentage = percentage;
        }

        if (percentage < requiredPercentage) {
            continue;
        }

        filtered.push(category);
    }

    visibleCategories.value = filtered;
});

watch(visibleCategories, () => {
    // Update seek height
    let height = 0;
    let yOffset = 0;
    const rows = categoryRows.value;

    if (!rows) {
        return;
    }

    for (const [index, category] of categories.value.entries()) {
        const visible = isVisible(category);
        if (!visible && height) {
            break;
        }
        const cell = rows[index];
        const d = cell?.$el as HTMLElement;
        if (d) {
            if (visible) {
                height += d.clientHeight;
            }
            else {
                yOffset += d.clientHeight;
            }
        }
    }

    if (height === 0) {
        // Maintain
        return;
    }
    seekeryOffset.value = yOffset;
    seekerHeight.value = height;
});

function isVisible(category: CategorizedViewCategory) {
    return visibleCategories.value.includes(category);
}

function addCategory(category: CategorizedViewCategory) {
    categories.value.push(category);
    sortCategories();

    return () => {
        // Remove category
        categories.value = categories.value.filter(c => c !== category);
    };
}

function scrollToCategory(category: CategorizedViewCategory) {
    const el = category.el.value;
    if (!el) {
        return;
    }
    const errorElement = el.querySelector('.error-box') as HTMLElement;
    if (errorElement) {
        ViewportHelper.scrollIntoView(errorElement, 'center');
    }
    else {
        ViewportHelper.scrollIntoView(el, 'top');
    }
}

function getChildElementIndex(node) {
    if (!node) {
        return 10000;
    }
    return Array.prototype.indexOf.call(node.parentNode.children, node);
}

function sortCategories() {
    // Sort by index of category.el
    categories.value = categories.value.sort((a, b) => Sorter.byNumberValue(getChildElementIndex(b.el.value), getChildElementIndex(a.el.value)));
}

const RenderSummary = defineComponent({
    name: 'RenderSummary',
    props: {
        category: {
            type: CategorizedViewCategory,
            required: true,
        },
    },
    setup(props) {
        return () => props.category.summarySlot?.();
    },
});

defineExpose({
    addCategory,
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.categorized-view {
    --st-popup-width: 950px;
    --st-horizontal-padding: 10px;

    > main.split {
        display: grid !important;
        grid-template-columns: 320px 1fr;

        > .summary {
            --st-horizontal-padding: 0px;
            padding-right: 30px;
            padding-top: 10px;
            padding-left: 30px;
        }

        > *:last-child {
            z-index: 1;
            padding: 0;
        }

        > *:first-child {
            //border-radius: $border-radius-modals;
            z-index: 1;
            //box-shadow: 0 2px 2px 1px rgba(0, 0, 0, 0.05), 0 0px 20px 0 rgba(0, 0, 0, 0.07);
            //border-right: 1px solid $color-border;

        }
    }

    .seeker-box {
        position: sticky;
        padding-top: 10px;
        top: 10px;

        .seeker {
            position: absolute;
            left: -15px;
            top: 10px;
            right: -15px;

            height: var(--seek-height);
            transform: translateY(var(--seek-y));
            contain: style paint;
            background: $color-background-shade-darker;
            transition: height 0.2s, transform 0.2s, opacity 0.2s;
            border-radius: $border-radius;
            z-index: -4;
        }
    }

}
</style>
