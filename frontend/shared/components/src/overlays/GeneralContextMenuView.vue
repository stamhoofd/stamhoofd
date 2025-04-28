<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView" @mousedown.prevent>
        <template v-for="(items, groupIndex) of menu.items" :key="groupIndex+'-group'">
            <ContextMenuLine v-if="groupIndex > 0" />

            <ContextMenuItemView v-for="(item, index) of items" :key="index" v-tooltip="item.disabled" :context-menu-view="$refs.contextMenuView" :class="{'disabled': !!item.disabled, 'with-description': !!item.description}" :child-context-menu="item.childMenu ? item.childMenu.getComponent() : undefined" @click="handleAction(item, $event)">
                <template v-if="item.selected !== null || item.leftIcon !== null" #left>
                    <Checkbox v-if="item.selected !== null" :model-value="item.selected" :only-line="true" />
                    <span v-else :class="'icon '+item.leftIcon" />
                </template>

                <p>{{ item.name }}</p>
                <p v-if="item.description" class="description">
                    {{ item.description }}
                </p>

                <template v-if="item.childMenu || item.icon !== null || item.rightText !== null" #right>
                    <span v-if="item.childMenu" class="icon arrow-right-small" />
                    <span v-else-if="item.icon !== null" :class="'icon '+item.icon" />
                    <span v-else class="style-context-menu-item-description">
                        {{ item.rightText }}
                    </span>
                </template>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script lang="ts">
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import Checkbox from '../inputs/Checkbox.vue';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import ContextMenuItemView from './ContextMenuItemView.vue';
import ContextMenuLine from './ContextMenuLine.vue';
import ContextMenuView from './ContextMenuView.vue';

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox,
    },
})
export default class GeneralContextMenuView extends VueComponent {
    @Prop({ required: false })
    menu: ContextMenu;

    handleAction(item: ContextMenuItem, event) {
        if (!item.action || item.disabled) {
            return;
        }
        item.action.call(item);
    }

    pop(popParents = false) {
        this.$refs.contextMenuView.pop(popParents);
    }
}
</script>
