<template>
    <component :is="elementName" class="context-menu-item" type="button" :class="[{ isOpen: isOpen, hover: isHovered }, $props.class]" @click.stop="onClick" @mouseover.passive="onMouseOver" @mouseleave.passive="onMouseLeave">
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
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import ContextMenuView from "./ContextMenuView.vue";

@Component({
    inheritAttrs: false
})
export default class ContextMenuItemView extends Mixins(NavigationMixin) {
    clicked = false;
    isHovered = false

    @Prop({ default: 'button' })
    elementName!: string;

    @Prop({ default: '' })
    class!: string;

    @Prop({ default: null })
    childContextMenu!: ComponentWithProperties | null;

    @Prop({required: true})
    contextMenuView!: InstanceType<typeof ContextMenuView>;

    get isOpen() {
        return (this.contextMenuView)?.childMenu && (this.contextMenuView).childMenu === this.childContextMenu
    }

    onMouseOver() {
        (this.contextMenuView).onHoverItem(this)
    }

    onMouseLeave() {
        (this.contextMenuView).onMouseLeaveItem(this)
    }

    onClick(event) {
        (this.contextMenuView).onClickItem(this, event)
        
    }
}
</script>
