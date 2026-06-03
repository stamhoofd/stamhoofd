<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView" @mousedown.prevent>
        <template v-for="(items, groupIndex) of menu.items" :key="groupIndex+'-group'">
            <ContextMenuLine v-if="groupIndex > 0" />

            <ContextMenuItemView v-for="(item, index) of items" :key="index" v-tooltip="item.disabled" :context-menu-view="$refs.contextMenuView" :class="{'disabled': !!item.disabled, 'with-description': !!item.description, destructive: item.destructive}" :child-context-menu="item.childMenu ? item.childMenu.getComponent() : undefined" @click="handleAction(item)">
                <template v-if="item.selected !== null || item.icon !== null" #left>
                    <Checkbox v-if="item.selected !== null" :model-value="item.selected" :only-line="true" />
                    <span v-else-if="item.icon" :class="'icon tiny '+item.icon" />
                </template>

                <p>{{ item.name }}</p>
                <p v-if="item.description" class="description">
                    {{ item.description }}
                </p>

                <template v-if="item.childMenu || item.icon !== null || item.rightText !== null" #right>
                    <span v-if="item.childMenu" class="icon arrow-right-small" />
                    <span v-else class="style-context-menu-item-description">
                        {{ item.rightText }}
                    </span>
                </template>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

import Checkbox from '../inputs/Checkbox.vue';
import type { ContextMenu, ContextMenuItem } from './ContextMenu';
import ContextMenuItemView from './ContextMenuItemView.vue';
import ContextMenuLine from './ContextMenuLine.vue';
import ContextMenuView from './ContextMenuView.vue';

const props = defineProps<{
    menu: ContextMenu;
}>();

const contextMenuView = ref<InstanceType<typeof ContextMenuView> | null>(null);

function handleAction(item: ContextMenuItem) {
    if (!item.action || item.disabled) {
        return;
    }
    item.action.call(item);
}

function pop(popParents = false) {
    contextMenuView.value?.pop(popParents);
}

function addFocusClass() {
    const target = props.menu.focusElement;
    if (target) {
        target.classList.add('focused');
    }
}

function removeFocusClass() {
    const target = props.menu.focusElement;
    if (target) {
        target.classList.remove('focused');
    }
}

onMounted(() => {
    addFocusClass();
});
onActivated(() => {
    addFocusClass();
});
onDeactivated(() => {
    removeFocusClass();
});
onBeforeUnmount(() => {
    removeFocusClass();
});

defineExpose({ pop });
</script>
