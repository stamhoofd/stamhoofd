<template>
    <component :is="elementName" class="context-menu-item" type="button" :class="{ isOpen: isOpen }" @click.passive="onClick" @mouseover.passive="onMouseOver">
        <div class="left">
            <slot name="left" />
        </div>
        <div class="middle">
            <slot />
        </div>
        <div class="right">
            <slot name="right" />
        </div>
    </component>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component
export default class ContextMenuItem extends Mixins(NavigationMixin) {
    clicked = false;

    @Prop({ default: 'button' })
    elementName!: string;

    @Prop({ default: null })
    childContextMenu!: ComponentWithProperties | null;

    get isOpen() {
        return (this.$parent as any).childMenu && (this.$parent as any).childMenu === this.childContextMenu
    }

    onMouseOver() {
        if (this.childContextMenu) {
            if (!this.childContextMenu.componentInstance()) {
                // Present child context menu + send close event to parent
                const el = this.$el as HTMLElement;
                const bounds = el.getBoundingClientRect()

                // todo: calculate better position
                this.childContextMenu.properties.x = bounds.right
                this.childContextMenu.properties.y = bounds.top
                this.childContextMenu.properties.xPlacement = "right"
                this.childContextMenu.properties.yPlacement = "bottom"
                this.childContextMenu.properties.parentMenu = this.$parent
                this.childContextMenu.properties.wrapWidth = el.clientWidth;
                
                (this.$parent as any).setChildMenu(this.childContextMenu);
                this.present(this.childContextMenu.setDisplayStyle("overlay"));

            }
        } else {
            (this.$parent as any).setChildMenu(null);
        }
    }

    onClick(event) {
        if (this.clicked) {
            return;
        }
        this.clicked = true
        this.$emit("click", event);

        // Allow some time to let the browser handle some events (e.g. label > update checkbox)
        setTimeout(() => {
            (this.$parent as any).pop(true);
        }, 80)
    }
}
</script>