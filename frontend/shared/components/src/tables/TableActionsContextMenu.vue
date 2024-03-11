<template>
    <ContextMenuView v-bind="$attrs">
        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />
            <ContextMenuItemView v-for="(action, index) of actions" :key="groupIndex+'-'+index" :class="{'disabled': isDisabled(action)}" :child-context-menu="getChildContextMenu(action)" @click="handleAction(action, $event)">
                {{ action.name }}
                <span v-if="action.hasChildActions" slot="right" class="icon arrow-right-small" />
                <span v-else-if="action.icon" slot="right" :class="'icon '+action.icon" />
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView, FetchAllOptions, Toast } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { TableAction } from "./TableAction";
import TableView from "./TableView.vue";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox
    },
})
export default class TableActionsContextMenu extends Mixins(NavigationMixin) {
    /**
     * Act only on selection given here
     */
    //@Prop({ default: () => [] })
    //focused!: any[];

    @Prop({ required: false })
    table?: TableView<any>;

    @Prop({ required: true })
    actions: TableAction<any>[];

    /**
     * Act only on selection given here
     */
    @Prop({ default: () => [] })
    selection!: {hasSelection: boolean, isSingle: boolean, getSelection(options?: FetchAllOptions): Promise<any[]>}

    isDisabled(action: TableAction<any>) {
        return action.isDisabled(this.hasSelection)//!this.hasSelection && action.needsSelection && (!this.table || !action.allowAutoSelectAll)
    }

    get hasSelection() {
        return this.selection.hasSelection
    }

    handleAction(action: TableAction<any>, event) {
        action.handle(this.selection)?.catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
        })
    }

    get groupedActions() {
        // Group all actions based on their groupIndex property, sorted by groupIndex
        return this.actions
            .filter(action => {
                if (!action.enabled) {
                    return false
                }
                if (action.singleSelection && !this.selection.isSingle) {
                    return false;
                }
                if (!action.needsSelection && this.selection.hasSelection) {
                    return false;
                }

                if ((this as any).$isMobile && this.isDisabled(action)) {
                    // On mobile, hide disabled actions, because we don't have enough room
                    return false
                }
                return true
            })
            .sort((a, b) => a.groupIndex - b.groupIndex)
            .reduce((acc, action) => {
                const group = acc[acc.length - 1];
                if (group && group[0].groupIndex == action.groupIndex) {
                    group.push(action);
                } else {
                    acc.push([action]);
                }
                return acc;
            }, [] as TableAction<any>[][])

    }

    getChildContextMenu(action: TableAction<any>) {
        if (action.childMenu) {
            return action.childMenu
        }

        if (!action.hasChildActions) {
            return;
        }

        return new ComponentWithProperties(TableActionsContextMenu, {
            actions: action.getChildActions(),
            table: this.table,
            selection: this.selection
        })
    }
}
</script>
