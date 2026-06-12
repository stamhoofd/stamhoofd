<template>
    <component :is="elementName" ref="el" class="context-menu-item" type="button" :class="[{ isOpen: isOpen, hover: isHovered }, ($props as any).class]" data-testid="context-menu-item" @click.stop="onClick" @mouseover.passive="onMouseOver" @mouseleave.passive="onMouseLeave">
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
/**
 * The public API a ContextMenuItemView exposes to its parent ContextMenuView.
 * The parent reads and mutates these directly while managing hover/child menus.
 */
export interface ContextMenuItemApi {
    isHovered: boolean;
    clicked: boolean;
    childContextMenu: ComponentWithProperties | null;
    el: HTMLElement | null;
    present: (component: ComponentWithProperties) => void;
    emitClick: (event: Event) => void;
}
</script>

<script lang="ts" setup>
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { usePresent } from '@simonbackx/vue-app-navigation';
import { computed, ref, useTemplateRef } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(defineProps<{
    elementName?: string;
    class?: any;
    childContextMenu?: ComponentWithProperties | null;
    contextMenuView: {
        childMenu: ComponentWithProperties | null;
        onHoverItem: (item: ContextMenuItemApi) => void;
        onMouseLeaveItem: (item: ContextMenuItemApi) => void;
        onClickItem: (item: ContextMenuItemApi, event: Event) => void;
    } | null;
}>(), {
    elementName: 'button',
    class: '',
    childContextMenu: null,
});

const emit = defineEmits<{
    (e: 'click', event: Event): void;
}>();

const present = usePresent();

const clicked = ref(false);
const isHovered = ref(false);
const elRef = useTemplateRef<HTMLElement>('el');

const isOpen = computed(() => props.contextMenuView?.childMenu && props.contextMenuView.childMenu === props.childContextMenu);

// The object the parent ContextMenuView receives as "item". We pass this instead
// of a component instance, exposing exactly the surface the parent manipulates.
const itemApi: ContextMenuItemApi = {
    get isHovered() {
        return isHovered.value;
    },
    set isHovered(value: boolean) {
        isHovered.value = value;
    },
    get clicked() {
        return clicked.value;
    },
    set clicked(value: boolean) {
        clicked.value = value;
    },
    get childContextMenu() {
        return props.childContextMenu;
    },
    get el() {
        return elRef.value;
    },
    present: (component: ComponentWithProperties) => {
        present(component).catch(console.error);
    },
    emitClick: (event: Event) => {
        emit('click', event);
    },
};

function onMouseOver() {
    props.contextMenuView?.onHoverItem(itemApi);
}

function onMouseLeave() {
    props.contextMenuView?.onMouseLeaveItem(itemApi);
}

function onClick(event: MouseEvent) {
    props.contextMenuView?.onClickItem(itemApi, event);
}
</script>
