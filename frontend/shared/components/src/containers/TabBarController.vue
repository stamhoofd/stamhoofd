<template>
    <div class="tab-bar-controller">
        <header>
            <div class="left">
                <InheritComponent name="tabbar-left" />
            </div>
            <div class="middle">
                <button v-for="item in tabs" :key="item.component.key" class="button item" :class="{ selected: selectedItem === item }" type="button" @click="selectItem(item)">
                    <div class="button text" :class="{ selected: selectedItem === item }">
                        <span :class="'icon '+item.icon" />
                        <span>{{ item.name }}</span>
                        <span v-if="item.badge" class="bubble">{{ item.badge }}</span>
                    </div>
                </button>

            </div>
            <div class="right">
                <InheritComponent name="tabbar-right" />
            </div>
        </header>
        <main ref="mainElement">
            <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
        </main>
    </div>
</template>

<script lang="ts">
import TabBarController from './TabBarController.vue';
import {inject, shallowRef} from 'vue';

export function useTabBarController(): Ref<InstanceType<typeof TabBarController>> {
    const c = inject('reactive_tabBarController') as InstanceType<typeof TabBarController>|Ref<InstanceType<typeof TabBarController>>;
    return shallowRef(c);
}
</script>

<script setup lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance, HistoryManager, PushOptions, defineRoutes, useUrl } from '@simonbackx/vue-app-navigation';
import { Ref, computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { TabBarItem } from './TabBarItem';
import InheritComponent from './InheritComponent.vue';
import { Formatter } from '@stamhoofd/utility';

const props = defineProps<{
    tabs: TabBarItem[]
}>()

const selectedItem: Ref<TabBarItem|null> = ref(null) as any as Ref<TabBarItem|null> // TypeScript is unpacking the TabBarItem to {...} for some reason

// Root is stored separately because we can also navigate to non-tabs
const root: Ref<ComponentWithProperties|null> = ref(null) as any as Ref<ComponentWithProperties|null>

const mainElement = ref<HTMLElement|null>(null)
const urlHelpers = useUrl()

defineRoutes(props.tabs.map(tab => {
    return {
        name: tab.name,
        url: Formatter.slug(tab.name),
        handler: async (options) => {
            if (options.checkRoutes) {
                tab.component.setCheckRoutes()
            }
            await selectItem(tab, options.adjustHistory)
        }
    }
}))

onMounted(() => {
    // If no default route was set, select the first
    if (!root.value && !selectedItem.value) {
        selectItem(props.tabs[0], false).catch(console.error)
    }
})

const instance = getCurrentInstance()
provide('reactive_tabBarController', instance?.proxy); // Sadly the proxy does not include exposed properties - ComponentWithProperties has a workaround at getExposeProxy

const getInternalScrollElements = () => {
    return (mainElement.value?.querySelectorAll(".st-view > main") ?? []) as NodeListOf<HTMLElement>
}

const saveCurrentItemState = () => {
    const old = selectedItem.value;
    if (old) {
        // Keep current item alive
        old.component.keepAlive = true;

        // Save scroll position
        const scrollElements = getInternalScrollElements();
        
        // Clear already saved items
        old.savedScrollPositions = new WeakMap()

        for (const element of scrollElements) {
            old.savedScrollPositions.set(element, element.scrollTop)
        }
    }
}
const selectItem = async (item: TabBarItem, appendHistory: boolean = true) => {
    if (item === selectedItem.value) {
        return
    }

    saveCurrentItemState()
    const old = selectedItem.value;

    // Set url namespace of the tab
    const tabUrl = Formatter.slug(item.name)
    item.component.provide.reactive_navigation_url = computed(() => urlHelpers.extendUrl(tabUrl))

    if (appendHistory) {
        if (item.component.isKeptAlive) {
            item.component.returnToHistoryIndex()
        } else {
            HistoryManager.pushState(undefined, old ? (async () => {
                await selectItem(old, false)
            }) : null, true);

            item.component.assignHistoryIndex()
        }
    } else {
        item.component.returnToHistoryIndex()
    }
        
    // Switch
    selectedItem.value = item
    root.value = item.component
    
    const positions = item.savedScrollPositions
    await nextTick()

    const newScrollElements = getInternalScrollElements();

    // Restore scroll position
    // Let the OS rerender once so all the positions are okay after dom insertion

    for (const element of newScrollElements) {
        const position = positions.get(element)
        if (!position) {
            continue
        }
        element.scrollTop = position
    }
}

const show = async (options: PushOptions) => {
    if (options.components.length > 1) {
        throw new Error('Impossible to show more than 1 component from a direct child of the TabBarController')
    }
    const component = options.components[0];

    const foundItem = props.tabs.find(tab => tab.component === component);
    if (foundItem) {
        return selectItem(foundItem)
    }

    if (!component || component === root.value) {
        return
    }

    saveCurrentItemState()

    if (options?.adjustHistory ?? true) {
        const old = selectedItem.value
        HistoryManager.pushState(undefined, old ? (async () => {
            await selectItem(old, false)
        }) : null, true);
        component.assignHistoryIndex()
    } else {
        component.returnToHistoryIndex()
    }
        
    // Switch
    selectedItem.value = null
    root.value = component
    
    // Wait for mount
    await nextTick()
}
provide('reactive_navigation_show', show)

onBeforeUnmount(() => {
    // Prevent memory issues by removing all references and destroying kept alive components
    for (const {component} of props.tabs) {
        // Destroy them one by one
        if (component.isKeptAlive && component.vnode) {
            component.destroy(component.vnode);
        }
    }
})

const returnToHistoryIndex = () => {
    return root.value?.returnToHistoryIndex();
}

defineExpose({
    returnToHistoryIndex,
    show
})

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.tab-bar-controller {
    --tab-bar-header-height: 70px;
    height: calc(var(--vh, 1vh) * 100);
    max-height: 100vh;
    max-height: 100dvh;
    overflow: hidden;
    overflow: clip; // More modern + disables scrolling
    --saved-vh: var(--vh, 1vh);

    > header {
        box-sizing: border-box;
        height: var(--tab-bar-header-height);
        border-bottom: $border-width-thin solid $color-border;
        background: $color-background;

        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;

        > .left {
            padding-left: 20px;
        }

        > .right {
            padding-right: 20px;

            // Align grid items right
            justify-self: end;
        }

        > .middle {
            display: flex;
            flex-direction: row;
            gap: 45px;
            justify-content: center;

            > .item {
                display: block;
                height: var(--tab-bar-header-height);

                > div {
                    height: var(--tab-bar-header-height);

                    display: flex;
                    text-align: center;
                    align-items: center;
                    justify-content: center;
                }
            }
        }
    }

    > main {
        // Pass an update to the --vh because we removed some
        background: var(--color-current-background);
        --vh: calc(var(--saved-vh, 1vh) - var(--tab-bar-header-height) / 100);
        height: calc(var(--vh, 1vh) * 100);

        // No scrolling here allowed. Child components should manage this
        overflow: hidden;
        overflow: clip; // More modern + disables scrolling
    }
}

</style>