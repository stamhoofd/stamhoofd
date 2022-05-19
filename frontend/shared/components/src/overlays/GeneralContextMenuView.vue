<template>
    <ContextMenuView v-bind="$attrs" @mousedown.native.prevent>
        <template v-for="(items, groupIndex) of menu.items">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />

            <ContextMenuItemView v-for="(item, index) of items" :key="groupIndex+'-'+index" v-tooltip="item.disabled" :class="{'disabled': !!item.disabled}" :child-context-menu="item.childMenu ? item.childMenu.getComponent() : undefined" @click="handleAction(item, $event)">
                <Checkbox v-if="item.selected !== null" slot="left" :checked="item.selected" :only-line="true" />
                <span v-else-if="item.leftIcon !== null" slot="left" :class="'icon '+item.leftIcon" />
                {{ item.name }}
                <span v-if="item.childMenu" slot="right" class="icon arrow-right-small" />
                <span v-else-if="item.icon !== null" slot="right" :class="'icon '+item.icon" />
                <span v-else-if="item.rightText !== null" slot="right" class="style-context-menu-item-description">
                    {{ item.rightText }}
                </span>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView, TooltipDirective } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { ContextMenu, ContextMenuItem } from "./ContextMenu";


@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class GeneralContextMenuView extends Mixins(NavigationMixin) {
    @Prop({ required: false })
    menu: ContextMenu;

    handleAction(item: ContextMenuItem, event) {
        if (!item.action || item.disabled) {
            return
        }
        const result = item.action.call(item, event) as boolean
        if (result === true) {
            // Dismiss
        } else {
            // Don't dismiss
        }
    }

}
</script>
