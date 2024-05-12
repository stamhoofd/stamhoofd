<template>
    <div class="tab-bar-controller">
        <header v-if="showTopBar">
            <div class="left">
                <InheritComponent name="tabbar-left" />
            </div>
            <div class="middle">
                <template v-if="tabs.length > 1">
                    <button v-for="(item, index) in tabs" :key="index" class="button item" :class="{ selected: item.isSelected(selectedItem) }" type="button" @click="(event) => selectTab(event, item)">
                        <div class="button text" :class="{ selected: item.isSelected(selectedItem) }">
                            <span :class="'icon '+item.icon" />
                            <span>{{ item.name }}</span>
                            <span v-if="unref(item.badge)" class="bubble">{{ unref(item.badge) }}</span>
                            <span v-if="item.isGroup" class="icon arrow-down-small gray" />
                        </div>
                    </button>
                </template>
            </div>
            <div class="right">
                <InheritComponent name="tabbar-right" />
            </div>
        </header>
        <main ref="mainElement" :class="{showTopBar, showBottomBar, shouldHideBottomBar: showBottomBar && shouldHideBottomBar}">
            <FramedComponent v-if="root" :key="root.key" :root="root" />
        </main>

        <footer v-if="showBottomBar" :class="{hidden: shouldHideBottomBar}">
            <button v-for="(item, index) in tabs" :key="index" class="button item" :class="{ selected: item.isSelected(selectedItem) }" type="button" @click="(event) => selectTab(event, item)">
                <div class="button text small column" :class="{ selected: item.isSelected(selectedItem) }">
                    <span :class="'icon '+item.icon" />
                    <span>
                        {{ item.name }}
                    </span>
                    <span v-if="unref(item.badge)" class="bubble">{{ unref(item.badge) }}</span>
                </div>
            </button>
        </footer>
    </div>
</template>

<script lang="ts">
import { inject, shallowRef } from 'vue';

import { useDeviceWidth } from '../VueGlobalHelper';
import TabBarController from './TabBarController.vue';
import TabBarDropdownView from './TabBarDropdownView.vue';

export function useTabBarController(): Ref<InstanceType<typeof TabBarController>> {
    const c = inject('reactive_tabBarController') as InstanceType<typeof TabBarController>|Ref<InstanceType<typeof TabBarController>>;
    return shallowRef(c);
}

export function useHideTabBar() {
    const reference = {}; // new object reference
    const injector = inject<any>('reactive_hide_tab_bar', null);

    const register = () => {
        const unwrapped = unref(injector);
        if (unwrapped && unwrapped.register) {
            unwrapped.register(reference);
        }
    };

    const unregister = () => {
        const unwrapped = unref(injector);
        if (unwrapped && unwrapped.unregister) {
            unwrapped.unregister(reference);
        }
    };

    onMounted(register);
    onActivated(register);
    onDeactivated(unregister);
    onBeforeUnmount(unregister);
}

</script>

<script setup lang="ts">
import { ComponentWithProperties, defineRoutes, FramedComponent, HistoryManager, NavigationController, PushOptions, usePresent, useUrl } from '@simonbackx/vue-app-navigation';
import { Formatter } from '@stamhoofd/utility';
import { ComponentPublicInstance, computed, getCurrentInstance, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, provide, Ref, ref, unref } from 'vue';

import InheritComponent from './InheritComponent.vue';
import { TabBarItem, TabBarItemGroup } from './TabBarItem';

const props = defineProps<{
    tabs: ((TabBarItem|TabBarItemGroup)[])|Ref<(TabBarItem|TabBarItemGroup)[]>
}>()

defineOptions({
    name: 'TabBarController'
})

type TabBarItemWithComponent = TabBarItem & Required<Pick<TabBarItem, 'component'>>;
const tabs = computed(() => {
    const base = unref(props.tabs);

    if (!showTopBar.value) {
        // Replace groups with tabs
        return base.flatMap(t => {
            if (t instanceof TabBarItemGroup) {
                return [
                    new TabBarItem({
                        ...t,
                        component: new ComponentWithProperties(NavigationController, {
                            root: new ComponentWithProperties(TabBarDropdownView, {
                                group: t,
                                selectedItem: selectedItem,
                                selectItem: selectItem
                            })
                        })
                    })
                ];
            }
            return [t]
        });
    }

    return base;
})

const flatTabs = computed<TabBarItemWithComponent[]>(() => unref(props.tabs).flatMap(t => t.items as TabBarItemWithComponent[]).filter(t => !!t.component))
const injectedComponents = inject('reactive_components') as Ref<Record<string, ComponentWithProperties>|undefined> | undefined;
const deviceWidth = useDeviceWidth()
const showTopBar = computed(() => deviceWidth.value > 1100);
const showBottomBar = computed(() => !showTopBar.value && tabs.value.length > 1);

const hieBottomBarRequesters = ref(new Set());
const shouldHideBottomBar = computed(() => {
    return hieBottomBarRequesters.value.size > 0;
})

provide('reactive_hide_tab_bar', {
    register: (reference: any) => {
        console.log('register')
        hieBottomBarRequesters.value.add(reference);
    },
    unregister: (reference: any) => {
        console.log('unregister')
        hieBottomBarRequesters.value.delete(reference);
    }
});

provide('reactive_components', computed(() => {
    if (!showTopBar.value) {
        return unref(injectedComponents) ?? {};
    }
    // All displayed
    return {
        ...(unref(injectedComponents) ?? {}),
        'tabbar-replacement': null
    };
}));


const selectedItem: Ref<TabBarItem|null> = ref(null) as any as Ref<TabBarItem|null> // TypeScript is unpacking the TabBarItem to {...} for some reason

// Root is stored separately because we can also navigate to non-tabs
const root: Ref<ComponentWithProperties|null> = ref(null) as any as Ref<ComponentWithProperties|null>

const mainElement = ref<HTMLElement|null>(null)
const urlHelpers = useUrl()
const present = usePresent()

defineRoutes(flatTabs.value.map(tab => {
    return {
        name: tab.name,
        url: Formatter.slug(tab.name),
        isDefault: {
            properties: {}
        },
        handler: async (options) => {
            if (options.checkRoutes) {
                tab.component.setCheckRoutes()
            }
            await selectItem(tab, options.adjustHistory)
        }
    }
}))

const instance = getCurrentInstance()
provide('reactive_tabBarController', instance?.proxy); // Sadly the proxy does not include exposed properties - ComponentWithProperties has a workaround at getExposeProxy

const getInternalScrollElements = () => {
    return (mainElement.value?.querySelectorAll(".st-view > main") ?? []) as NodeListOf<HTMLElement>
}

const saveCurrentItemState = () => {
    const old = selectedItem.value;
    if (old && old.component) {
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

const shouldNavigateAway = async () => {
    const old = root.value
    if (old) {
        return await old.shouldNavigateAway()
    }
    return true;
}

async function selectItem (item: TabBarItem, appendHistory: boolean = true) {
    if (item === selectedItem.value) {
        // Try to scroll this item to the top
        if (mainElement.value) {
            const scrollElement = mainElement.value.querySelector(".st-view > main");
            if (scrollElement) {
                if (scrollElement.scrollTop != 0) {
                    // Scroll to top animated
                    scrollElement.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    })
                } else {
                    // todo: try to pop
                }
            }
        }
        return
    }

    if (!await shouldNavigateAway()) {
        return
    }

    if (!item.component) {
        if (item.action) {
            await item.action.call(instance!.proxy as ComponentPublicInstance)
        }
        return;
    }

    saveCurrentItemState()
    const old = selectedItem.value;

    // Set url namespace of the tab
    const tabUrl = Formatter.slug(item.name)
    item.component.provide.reactive_navigation_url = computed(() => urlHelpers.extendUrl(tabUrl))

    if (appendHistory) {
        HistoryManager.pushState(undefined, old ? (async () => {
            await selectItem(old, false)
        }) : null, {adjustHistory: true});

        item.component.assignHistoryIndex()
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

const selectTab = async (event: MouseEvent, tab: TabBarItem|TabBarItemGroup) => {
    if (tab instanceof TabBarItem) {
        return selectItem(tab);
    }

    if (!showTopBar.value) {
        // Treat as a normal tab
        return;
    }

    const padding = 15;
    let width = 400;
    const button = event.currentTarget as HTMLElement
    const bounds = button.getBoundingClientRect()
    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName("body")[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth;

    let left = bounds.left - padding;

    if (left + width > clientWidth + padding) {
        left = clientWidth - padding - width;

        if (left < padding) {
            left = padding;
            width = clientWidth - padding * 2;
        }
    }

    // Open dropdown menu
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(TabBarDropdownView, {
                    group: tab,
                    selectedItem: selectedItem,
                    selectItem: selectItem
                })
            }, {
                provide: {
                    reactive_navigation_disable_url: true
                }
            })
        ],
        modalDisplayStyle: 'popup',
        modalClass: 'positionable-sheet',
        modalCssStyle: '--sheet-position-left: '+left.toFixed(1)+'px; --sheet-position-top: 65px; --sheet-vertical-padding: 15px; --st-popup-width: ' + width.toFixed(1) + 'px; ',
    })
};


const show = async (options: PushOptions) => {
    if (options.components.length > 1) {
        throw new Error('Impossible to show more than 1 component from a direct child of the TabBarController')
    }
    if (!await shouldNavigateAway()) {
        return
    }
    const component = options.components[0];

    const foundItem = flatTabs.value.find(tab => tab.component === component);
    if (foundItem) {
        return selectItem(foundItem)
    }

    if (!component || component === root.value) {
        return
    }

    saveCurrentItemState()

    const old = selectedItem.value
    HistoryManager.pushState(undefined, old ? (async () => {
        await selectItem(old, false)
    }) : null, {
        adjustHistory: options?.adjustHistory ?? true,
        invalid: options?.invalidHistory ?? false,
    });
    component.assignHistoryIndex()
        
    // Switch
    selectedItem.value = null
    root.value = component
    
    // Wait for mount
    await nextTick()
}
provide('reactive_navigation_show', show)

onBeforeUnmount(() => {
    // Prevent memory issues by removing all references and destroying kept alive components
    for (const {component} of flatTabs.value) {
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
    show,
    shouldNavigateAway
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
    --saved-keyboard-height: var(--keyboard-height, 0px);
    --saved-st-safe-area-bottom: var(--st-safe-area-bottom, 0px);

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

        &.showTopBar {
            --vh: calc(var(--saved-vh, 1vh) - var(--tab-bar-header-height) / 100);
            --st-safe-area-top: 0px; // Handled by header
        }

        &.showBottomBar {
            --st-safe-area-bottom: calc(var(--saved-st-safe-area-bottom) + var(--tab-bar-header-height)); // Handled by footer
            
            &.shouldHideBottomBar {
                --st-safe-area-bottom: var(--saved-st-safe-area-bottom);
            }
        }
    
        height: calc(var(--vh, 1vh) * 100);

        // No scrolling here allowed. Child components should manage this
        overflow: hidden;
        overflow: clip; // More modern + disables scrolling
    }


    > footer {
        height: var(--tab-bar-header-height);
        border-top: $border-width-thin solid $color-border;
        background: $color-background-shade;
        background: color-mix(in srgb, $color-background-shade 70%, transparent);
        padding-bottom: var(--st-safe-area-bottom, 0px);
        user-select: none;

        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);

        transition: transform 0.2s, opacity 0.2s;

        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
            
        > button {
            min-width: 0;
            overflow: hidden;
        }

        &.hidden {
            opacity: 0;
            transform: translateY(100%);
        }
    }
}

</style>
