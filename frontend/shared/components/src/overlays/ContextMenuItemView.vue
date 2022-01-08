<template>
    <component :is="elementName" class="context-menu-item" type="button" :class="{ isOpen: isOpen, hover: isHovered }" @click.passive="onClick" @mouseover.passive="onMouseOver" @mouseleave.passive="onMouseLeave">
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
export default class ContextMenuItemView extends Mixins(NavigationMixin) {
    clicked = false;
    isHovered = false

    @Prop({ default: 'button' })
    elementName!: string;

    @Prop({ default: null })
    childContextMenu!: ComponentWithProperties | null;

    get isOpen() {
        return (this.$parent as any).childMenu && (this.$parent as any).childMenu === this.childContextMenu
    }

    onMouseOver() {
        (this.$parent as any).onHoverItem(this)
    }

    onMouseLeave() {
        (this.$parent as any).onMouseLeaveItem(this)
    }

    onClick(event) {
        (this.$parent as any).onClickItem(this, event)
        
    }
}
</script>