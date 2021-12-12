<template>
    <ContextMenu v-bind="{...$attrs}">
        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />
            <ContextMenuItem v-for="(action, index) of actions" :key="groupIndex+'-'+index" :disabled="!hasSelection && action.needsSelection && !action.allowAutoSelectAll" :child-context-menu="getChildContextMenu(action)" @click="handleAction(action)">
                {{ action.name }}
                <span v-if="action.childMenu || action.childActions.length > 0" slot="right" class="icon arrow-right-small" />
                <span v-else-if="action.icon" slot="right" :class="'icon '+action.icon" />
            </ContextMenuItem>
        </template>
    </ContextMenu>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ContextMenu, ContextMenuItem, ContextMenuLine, Toast } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

import ColumnSelectorContextMenu from "./ColumnSelectorContextMenu.vue";
import { TableAction } from "./TableAction";
import TableView from "./TableView.vue";

@Component({
    components: {
        ContextMenu,
        ContextMenuItem,
        ContextMenuLine,
        Checkbox
    },
})
export default class TableActionsContextMenu extends Mixins(NavigationMixin) {
    /**
     * Act only on selection given here
     */
    @Prop({ default: () => [] })
    focused!: any[];

    @Prop({ required: true })
    table!: TableView<any>;

    @Prop({ required: true })
    actions: TableAction<any>[];

    get hasSelection() {
        return this.focused.length > 0 || this.table.cachedSelectionCount > 0;
    }

    get showSelection() {
        return this.table.showSelection;
    }

    get isAllSelected() {
        return this.table.cachedAllSelected
    }

    get columns() {
        return this.table.allColumns
    }

    get isFocusSelected() {
        return this.focused.length > 0 && this.focused.every(item => this.table.isValueSelected(item));
    }

    get columnContextMenu() {
        return new ComponentWithProperties(ColumnSelectorContextMenu, {
            columns: this.table.allColumns,
        })
    }

    toggleSelect() {
        this.table.setShowSelection(true)

        // Select focussed items
        if (this.isFocusSelected) {
            this.table.setSelectionValues(this.focused, false);
        } else {
            this.table.setSelectionValues(this.focused, true);
        }
    }

    handleAction(action: TableAction<any>) {
        if (this.focused.length > 0) {
            action.handler(this.focused)?.catch((e) => {
                console.error(e)
                Toast.fromError(e).show
            })
        } else {
            this.table.handleAction(action)
        }
    }

    setSelectAll(all: boolean) {
        this.table.setSelectAll(all)
    }

    get groupedActions() {
        // Group all actions based on their groupIndex property, sorted by groupIndex
        return this.actions
            .filter(action => {
                if (!action.enabled) {
                    return false
                }
                if (action.singleSelection && this.focused.length != 1) {
                    return false;
                }
                if (!action.needsSelection && this.focused.length > 0) {
                    return false;
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

        if (!action.childActions || action.childActions.length == 0) {
            return
        }

        return new ComponentWithProperties(TableActionsContextMenu, {
            actions: action.childActions,
            table: this.table,
            focused: this.focused,
        })
    }
}
</script>
