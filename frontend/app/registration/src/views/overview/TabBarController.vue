<template>
    <div class="tab-bar-controller">
        <div class="main">
            <FramedComponent ref="component" :key="root.key" :root="root" />
        </div>
        <div class="tab-bar">
            <button v-for="item in items" :key="item.component.key" class="button text small" :class="{ selected: activeItem === item }" @click="selectItem(item)">
                <span :class="'icon '+item.icon" />
                <span>{{ item.name }}</span>
            </button>
        </div>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, FramedComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins,Prop } from "vue-property-decorator";

export class TabBarItem {
    name = ""
    icon = ""
    component: ComponentWithProperties
    savedScrollPosition: null | number = null

    constructor(name: string, icon: string, component: ComponentWithProperties) {
        this.name = name
        this.icon = icon
        this.component = component
    }
}

@Component({
    components: {
        FramedComponent
    }
})
export default class TabBarController extends Mixins(NavigationMixin){
    @Prop({ required: true })
    items!: TabBarItem[]

    selectedItem: null | TabBarItem = null

    get activeItem() {
        return this.selectedItem ?? this.items[0]
    }

    get root() {
        return this.activeItem.component
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
                        navigationController.pop()
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

    destroyed() {
        console.log("Destroyed tab bar controller");

        // Prevent memory issues by removing all references and destroying kept alive components
        for (const item of this.items) {
            // Destroy them one by one
            if (item.component.isKeptAlive) {
                item.component.destroy();
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

    > .main {
        --st-safe-area-bottom: calc(var(--saved-st-safe-area-bottom, 0px) + 62px);
    }

    >.tab-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        border-top: 2px solid $color-border;
        padding-bottom: var(--st-safe-area-bottom, 0px);
        background: rgba($color-background, 0.7);
        backdrop-filter: blur(10px);

        display: flex;
        flex-direction: row;
        align-items: center;
        
        > button {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: auto;
            line-height: 1;

            &.selected {
                color: $color-primary;
            }

            > span {
                margin-bottom: 4px;
            }
        }
    }
}
</style>