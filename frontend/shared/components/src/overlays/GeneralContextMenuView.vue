<template>
    <div>
    <ContextMenuView v-bind="$attrs" @mousedown.native.prevent ref="contextMenuView">
        <template v-for="(items, groupIndex) of menu.items" :key="groupIndex+'-group'" >
            <ContextMenuLine v-if="groupIndex > 0" />

            <ContextMenuItemView v-for="(item, index) of items" :contextMenuView="$refs.contextMenuView" :key="index" v-tooltip="item.disabled" :class="{'disabled': !!item.disabled, 'with-description': !!item.description}" :child-context-menu="item.childMenu ? item.childMenu.getComponent() : undefined" @click="handleAction(item, $event)">
                <template v-if="item.selected !== null" #left ><Checkbox :checked="item.selected" :only-line="true" /></template>
                <template v-else-if="item.leftIcon !== null" #left><span :class="'icon '+item.leftIcon" /></template>
                <p>{{ item.name }}</p>
                <p v-if="item.description" class="description">
                    {{ item.description }}
                </p>
                <template v-if="item.childMenu" #right><span class="icon arrow-right-small" /></template>
                <template v-else-if="item.icon !== null" #right><span :class="'icon '+item.icon" /></template>
                <template v-else-if="item.rightText !== null" #right><span class="style-context-menu-item-description">
                    {{ item.rightText }}
                </span></template>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import Checkbox from "../inputs/Checkbox.vue";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import ContextMenuItemView from "./ContextMenuItemView.vue";
import ContextMenuLine from "./ContextMenuLine.vue";
import ContextMenuView from "./ContextMenuView.vue";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox
    }
})
export default class GeneralContextMenuView extends Mixins(NavigationMixin) {
    @Prop({ required: false })
        menu: ContextMenu;

    handleAction(item: ContextMenuItem, event) {
        if (!item.action || item.disabled) {
            return
        }
        item.action.call(item, event)
    } 

}
</script>
