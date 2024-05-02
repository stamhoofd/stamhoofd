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
            <ComponentWithPropertiesInstance :key="root.key" :component="root" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithPropertiesInstance } from '@simonbackx/vue-app-navigation';
import { Ref, computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { TabBarItem } from './TabBarItem';
import InheritComponent from './InheritComponent.vue';

const props = defineProps<{
    tabs: TabBarItem[]
}>()

const selectedItem: Ref<TabBarItem> = ref(props.tabs[0]) as any as Ref<TabBarItem> // TypeScript is unpacking the TabBarItem to {...} for some reason
const root = computed(() => selectedItem.value.component)
const mainElement = ref<HTMLElement|null>(null)

const getInternalScrollElements = () => {
    return (mainElement.value?.querySelectorAll(".st-view > main") ?? []) as NodeListOf<HTMLElement>
}

const selectItem = async (item: TabBarItem) => {
    if (item === selectedItem.value) {
        return
    }

    const old = selectedItem.value;

    // Keep current item alive
    old.component.keepAlive = true;

    // Save scroll position
    const scrollElements = getInternalScrollElements();
    
    // Clear already saved items
    old.savedScrollPositions = new WeakMap()

    for (const element of scrollElements) {
        old.savedScrollPositions.set(element, element.scrollTop)
    }
    
    // Switch
    selectedItem.value = item
    
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

onBeforeUnmount(() => {
    // Prevent memory issues by removing all references and destroying kept alive components
    for (const {component} of props.tabs) {
        // Destroy them one by one
        if (component.isKeptAlive && component.vnode) {
            component.destroy(component.vnode);
        }
    }
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