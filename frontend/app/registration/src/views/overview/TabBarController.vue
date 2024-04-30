<template>
    <div class="tab-bar-controller">
        <STNavigationBar :fixed="true" :large="true">
            <template #left>
                <OrganizationLogo :organization="organization" />
            </template>
            <template #right>
                <button v-for="item in items" :key="item.component.key" class="button text" :class="{ selected: activeItem === item }" type="button" @click="selectItem(item)">
                    <span :class="'icon '+item.icon" />
                    <span>{{ item.name }}</span>
                    <span v-if="item.badge" class="bubble">{{ item.badge }}</span>
                </button>
            </template>
        </STNavigationBar>
        <div class="main">
            <FramedComponent ref="component" :key="root.key" :root="root" />
        </div>
        <div class="tab-bar">
            <button v-for="item in items" :key="item.component.key" class="button text small column" :class="{ selected: activeItem === item }" type="button" @click="selectItem(item)">
                <span :class="'icon '+item.icon" />
                <span>{{ item.name }}</span>
                <span v-if="item.badge" class="bubble">{{ item.badge }}</span>
            </button>
        </div>
    </div>
</template>


<script lang="ts">
import { FramedComponent, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { OrganizationLogo, STNavigationBar } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";


import { TabBarItem } from "../../classes/TabBarItem";

@Component({
    components: {
        FramedComponent,
        STNavigationBar,
        OrganizationLogo
    }
})
export default class TabBarController extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        items!: TabBarItem[]

    selectedItem: null | TabBarItem = null

    get activeItem() {
        return this.selectedItem ?? this.items[0]
    }

    get root() {
        return this.activeItem.component
    }

    get organization() {
        return this.$organization
    }

    selectItem(item: TabBarItem) {
        const scrollElement = this.getScrollElement()
        if (this.activeItem === item) {
            if (scrollElement.scrollTop > 0) {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            } else {
                const navigationController = this.activeItem.component.componentInstance()
                console.log("try pop", navigationController)
                if (navigationController && navigationController instanceof NavigationController) {
                    if (navigationController.components.length > 1) {
                        // try to pop
                        navigationController.pop().catch(console.error)
                    }
                }
            }
            
            return
        }

        this.activeItem.savedScrollPosition = scrollElement.scrollTop;

        // Keep the component alive while it is removed from the DOM
        this.activeItem.component.keepAlive = true;

        this.selectedItem = item

        console.log("saving scroll position", scrollElement.scrollTop);

        requestAnimationFrame(() => {
            // Need to wait for a rerender, because DOM is not updated yet
            if (this.activeItem.savedScrollPosition) {
                console.log("restoring scroll position", this.activeItem.savedScrollPosition);
                scrollElement.scrollTop = this.activeItem.savedScrollPosition
            } else {
                scrollElement.scrollTop = 0;
            }
        })
    }

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        if (!element) {
            element = this.$el as HTMLElement;
        }

        const style = window.getComputedStyle(element);
        if (style.overflowY == "scroll" || style.overflow == "scroll" || style.overflow == "auto" || style.overflowY == "auto") {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    unmounted() {
        console.log("Destroyed tab bar controller");

        // Prevent memory issues by removing all references and destroying kept alive components
        for (const item of this.items) {
            // Destroy them one by one
            if (item.component.isKeptAlive) {
                item.component.destroy(item.component.vnode);
            }
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
.tab-bar-controller {
    --saved-st-safe-area-bottom: var(--st-safe-area-bottom);
    --st-safe-area-top: var(--st-safe-area-top);
    > .main {
        @media (min-width: 701px) {
            --st-safe-area-top: calc(var(--saved-st-safe-area-top, 0px) + 80px);
        }
        @media (max-width: 700px) {
            --st-safe-area-bottom: calc(var(--saved-st-safe-area-bottom, 0px) + 62px);
        }
    }

    > .st-navigation-bar {
        @media (max-width: 700px) {
            display: none;
        }
    }

    >.tab-bar {
        @media (min-width: 701px) {
            display: none;
        }
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        border-top: $border-width-thin solid $color-border;
        padding-bottom: var(--st-safe-area-bottom, 0px);
        background: rgba($color-background, 0.7);
        backdrop-filter: blur(10px);
        z-index: 100;

        display: flex;
        flex-direction: row;
        align-items: center;
        
        > button {
            flex-grow: 1;
        }
    }
}
</style>