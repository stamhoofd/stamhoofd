<template>
    <div class="st-view" :class="{'categorized-view': columnsEnabled && isEnabled,'shade': columnsEnabled && isEnabled, 'categorized-boxes': isEnabled}">
        <div v-if="columnsEnabled && isEnabled">
            <div class="st-view summary-column background">
                <main>
                    <h1 class="style-navigation-title">
                        {{ title }}
                    </h1>
                    <div ref="seeker-box" class="seeker-box">
                        <STList>
                            <STListItem v-for="(category, index) of categories" :key="index" ref="categoryRows" :selectable="true" class="" @click="scrollToCategory(category)">
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
                </main>
            </div>
        </div>
        <div ref="scrollColumn">
            <SaveView v-bind="attrs" class="scroll-column" :class="{'main-shade': !columnsEnabled && isEnabled, 'shade': columnsEnabled && isEnabled}" @save="$emit('save', $event)" v-on="{delete: canDelete ? () => $emit('delete'): undefined}">
                <template v-if="!columnsEnabled && isEnabled" #fixed>
                    <ScrollableSegmentedControl v-model="visibleCategory" :items="[null, ...categories]" :labels="['Overzicht', ...categories.map(c => c.title.value)]" :icons="[null, ...categories.map(c => c.icon.value)]" />
                </template>
                <header v-if="!columnsEnabled && isEnabled" class="container">
                    <h1>
                        {{ title }}
                    </h1>
                    <div class="inline-seeker-box">
                        <STList>
                            <STListItem v-for="(category, index) of categories" :key="index" :selectable="true" class="" @click="scrollToCategory(category)">
                                <template #left>
                                    <span :class="'icon ' + category.icon.value" />
                                </template>
                                <h2 class="style-title-list">
                                    {{ category.title.value }}
                                </h2>

                                <RenderSummary :category="category" />

                                <template #right>
                                    <span v-if="category.hasError?.value" class="icon error red" />
                                    <span class="icon arrow-down-small gray" />
                                </template>
                            </STListItem>
                        </STList>
                    </div>
                </header>
                <div>
                    <slot />
                </div>
            </SaveView>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Sorter } from '@stamhoofd/utility';
import { computed, defineComponent, getCurrentInstance, onMounted, ref, Ref, useTemplateRef, watch } from 'vue';
import { ViewportHelper } from '../../ViewportHelper';
import { useDeviceWidth, useScrollListener } from '../../hooks';
import SaveView from '../../navigation/SaveView.vue';
import { SaveViewDefaults, SaveViewProps } from '../../navigation/SaveViewProps';
import STList from '../STList.vue';
import STListItem from '../STListItem.vue';
import { CategorizedViewCategory } from './CategorizedViewCategory';
import { ScrollableSegmentedControl } from '../../inputs';

const attrs = withDefaults(
    defineProps<SaveViewProps>(),
    SaveViewDefaults,
);

const categories = ref([]) as Ref<CategorizedViewCategory[]>;
const visibleCategories = ref([]) as Ref<CategorizedViewCategory[]>;
const categoryRows = useTemplateRef('categoryRows');
const scrollColumn = useTemplateRef('scrollColumn');

const seekerHeight = ref(0);
const seekeryOffset = ref(0);
const maximumSummaryHeight = ref(null) as Ref<number | null>;
let tick = false;

const isEnabled = computed(() => {
    return categories.value.length > 1;
});

const deviceWidth = useDeviceWidth();

const columnsEnabled = computed(() => {
    return deviceWidth.value >= 800;
});

const canDelete = computed(() => {
    // Check has delete listener
    return !!getCurrentInstance()?.vnode.props?.onDelete;
});

function updateVisible() {
    // Prevent multiple updates in the same frame
    if (tick) {
        return;
    }
    tick = true;
    requestAnimationFrame(() => {
        tick = false;
        const scrollEl = scrollElement.value;
        if (!scrollEl) {
            return;
        }

        const scrollRect = scrollEl.getBoundingClientRect();
        maximumSummaryHeight.value = scrollRect.height;

        let topPadding = parseInt(window.getComputedStyle(scrollEl, null).getPropertyValue('padding-top'));
        if (isNaN(topPadding)) {
            topPadding = 0;
        }

        let bottomPadding = parseInt(window.getComputedStyle(scrollEl, null).getPropertyValue('padding-bottom'));
        if (isNaN(bottomPadding)) {
            bottomPadding = 0;
        }

        if (scrollRect.height === 0) {
            return;
        }

        let filtered: CategorizedViewCategory[] = [];
        let requiredPercentage = 0.5;
        let percentageMap: Map<CategorizedViewCategory, number> = new Map();

        for (const category of categories.value) {
            const box = category.el.value;
            if (!box) {
                continue;
            }

            // todo: cache dimensions and offset of all category elements
            // getBoundingClientRect is very expensive
            const rect = box.getBoundingClientRect();
            if (rect.top > scrollRect.bottom - bottomPadding) {
                // Not visible
                continue;
            }

            if (rect.bottom < scrollRect.top + topPadding) {
                // Not visible
                continue;
            }

            const start = Math.max(rect.top, scrollRect.top + topPadding);
            const end = Math.min(rect.bottom, scrollRect.bottom - bottomPadding);
            const visibleHeight = end - start;
            const percentage = Math.min(1, Math.max(visibleHeight / (scrollRect.height - topPadding - bottomPadding), visibleHeight / rect.height));
            percentageMap.set(category, percentage);

            // Keep track of the maximum
            if (percentage > requiredPercentage) {
                requiredPercentage = percentage;
            }
        }

        for (const [category, percentage] of percentageMap.entries()) {
            if (percentage >= requiredPercentage) {
                filtered.push(category);
            }
        }

        visibleCategories.value = filtered;
    });
}

/**
 * This is a real throttle. The throttle method in utility is a debounce.
 */
function throttle(mainFunction, delay: number) {
    let timerFlag: NodeJS.Timeout | null = null; // Variable to keep track of the timer
    let runAtEnd = false;

    // Returning a throttled version
    return (...args) => {
        if (timerFlag === null) { // If there is no timer currently running
            requestAnimationFrame(() => {
                mainFunction(...args); // Execute the main function
            });
            runAtEnd = false;
            timerFlag = setTimeout(() => { // Set a timer to clear the timerFlag after the specified delay
                requestAnimationFrame(() => {
                    timerFlag = null; // Clear the timerFlag to allow the main function to be executed again
                    if (runAtEnd) {
                        mainFunction(...args);
                    }
                });
            }, delay);
        }
        else {
            // Make sure to run at the end of current period
            runAtEnd = true;
        }
    };
}

const throttledUpdateVisible = throttle(updateVisible, 80);

function getScrollElement() {
    return scrollColumn.value?.querySelector('main');
}

const scrollElement = ref(null) as Ref<HTMLElement | null>;
watch(scrollColumn, () => {
    scrollElement.value = getScrollElement() ?? null;
    updateVisible();
});

onMounted(() => {
    updateVisible();
});

useScrollListener(scrollElement, () => {
    throttledUpdateVisible();
});

watch([visibleCategories, categoryRows], () => {
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

const visibleCategory = computed({
    get: () => {
        return visibleCategories.value[0] ?? null;
    },
    set: (c: CategorizedViewCategory | null) => {
        if (c) {
            scrollToCategory(c);
        }
        else {
            const s = scrollElement.value;
            if (s) {
                const exponential = function (x: number): number {
                    return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
                };
                ViewportHelper.scrollTo(s, 0, 200, exponential);
            }
        }
    },
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
        ViewportHelper.scrollIntoView(errorElement, 'center', false);
    }
    else {
        ViewportHelper.scrollIntoView(el, 'center', false);
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
    display: grid !important;
    grid-template-columns: 1fr;

    --saved-vw: var(--vw, 1vw);

    @media (min-width: 800px) {
        grid-template-columns: 350px 1fr;

        .scroll-column {
            --vw: calc((var(--saved-vw, 1vw) * 100 - 350px) / 100);
        }
    }

    --st-popup-width: 1200px;

    > main {
        --st-horizontal-padding: 15px;
    }

    > div:first-child {
        --st-horizontal-padding: 30px;
        z-index: 1;

        @media (max-width: 800px) {
            display: none;
        }
    }

    > div > .summary-column {
        border-top-right-radius: $border-radius-modals;
        border-bottom-right-radius: $border-radius-modals;
        box-shadow:
        inset 0px 0.5px 1.4px 0.1px rgba(0, 0, 0, 0.02),
        0px 0px 0px 1px rgba(0, 0, 0, 0.02), // Smoothen border
        0px 0.7px 0.7px 0px rgba(0, 0, 0, 0.015),
        0px 1.4px 1.4px 0px rgba(0, 0, 0, 0.015 - 0.015/4),
        0px 2.8px 2.8px 0px rgba(0, 0, 0, 0.015- 0.015/4- 0.015/4),
         0 2px 2px 1px rgba(0, 0, 0, 0.03), 0 0px 20px 0 rgba(0, 0, 0, 0.02);
         border-right: $border-width solid $color-border;
    }

    .scroll-column {
        main {
            --st-horizontal-padding: 25px;

            @media (max-width: 800px) {
                --st-horizontal-padding: 20px;
            }

            @media (max-width: 600px) {
                --st-horizontal-padding: 10px;
            }
        }

    }

    .seeker-box {
        position: relative;
        bottom: 0;
        padding-top: 10px;

        &:active, &:hover {
            .seeker {
                opacity: 0.7;
            }
        }

        .seeker {
            position: absolute;
            left: 0;
            top: 10px;
            right: 0;

            margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

            height: var(--seek-height);
            transform: translateY(var(--seek-y));
            contain: style paint;
            background: $color-background-shade-darker;
            opacity: 1;
            transition: height 0.2s, transform 0.2s, opacity 0.2s;
            z-index: -2;
        }
    }

}
</style>
