<template>
    <div class="segmented-view">
        <!-- The v-if="root" fixes animation on initial load, so there is no animation for the first selected tab -->
        <SegmentedControl v-if="root" v-model="segmentedControlItem" :items="segmentedControlItems" :labels="segmentedControlLabels" />
        <FramedComponent v-if="root" :key="root.key" :root="root" v-bind="$attrs" />
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, FramedComponent, HistoryManager, useCurrentComponent, useUrl } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, Ref, ref, unref } from 'vue';
import { SegmentedControl } from '../inputs';

type Item = { name: string; component: ComponentWithProperties };

const props = withDefaults(defineProps<{
    tabs: Item[];
    initialTab?: number | null;
}>(), {
    initialTab: null,
});

defineOptions({
    name: $t(`e1193431-b95a-4a8a-94b2-8659005dcb77`),
});
const emit = defineEmits<{ (e: 'change', item: Item): void }>();

const selectedItem: Ref<Item | null> = ref(null) as any as Ref<Item | null>; // TypeScript is unpacking the TabBarItem to {...} for some reason

// Root is stored separately because we can also navigate to non-tabs
const root: Ref<ComponentWithProperties | null> = ref(null) as any as Ref<ComponentWithProperties | null>;

const urlHelpers = useUrl();
const currentComponent = useCurrentComponent();

const segmentedControlItems = computed(() => {
    return props.tabs.map(t => t.component);
});

const segmentedControlLabels = computed(() => {
    return props.tabs.map(t => t.name);
});

const segmentedControlItem = computed({
    get: () => {
        return selectedItem.value?.component ?? segmentedControlItems.value[0];
    },
    set: (v: ComponentWithProperties) => {
        const item = props.tabs.find(t => t.component === v);
        if (!item) {
            return;
        }
        selectItem(item).catch(console.error);
    },
});

defineRoutes(props.tabs.map((tab, index) => {
    const name = unref(tab.name);
    return {
        name,
        url: Formatter.slug(name),
        isDefault: index === props.initialTab || props.initialTab === null
            ? {
                    properties: {},
                }
            : undefined,
        handler: async (options) => {
            if (options.checkRoutes) {
                tab.component.setCheckRoutes();
            }
            await selectItem(tab, options.adjustHistory);
        },
    };
}));

const shouldNavigateAway = async () => {
    const old = root.value;
    if (old) {
        return await old.shouldNavigateAway();
    }
    return true;
};

async function selectItem(item: Item, appendHistory: boolean = true) {
    if (item === selectedItem.value) {
        // Try to scroll this item to the top
        return;
    }

    if (!await shouldNavigateAway()) {
        return;
    }

    const old = selectedItem.value;

    if (currentComponent) {
        item.component.inheritFromDisplayer(currentComponent);
    }

    // Set url namespace of the tab
    const tabUrl = Formatter.slug(unref(item.name));
    item.component.provide.reactive_navigation_url = computed(() => urlHelpers.extendUrl(tabUrl));

    if (appendHistory) {
        HistoryManager.pushState(undefined, old
            ? async () => {
                await selectItem(old, false);
            }
            : null, { adjustHistory: true });
    }
    item.component.assignHistoryIndex();

    // Switch
    selectedItem.value = item;
    root.value = item.component;
    emit('change', item);
}

onBeforeUnmount(() => {
    // Prevent memory issues by removing all references and destroying kept alive components
    for (const { component } of props.tabs) {
        // Destroy them one by one
        if (component.isKeptAlive && component.vnode) {
            component.destroy(component.vnode);
        }
    }
});

const returnToHistoryIndex = () => {
    return root.value?.returnToHistoryIndex();
};

defineExpose({
    returnToHistoryIndex,
    shouldNavigateAway,
});

</script>
