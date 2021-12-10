<template>
    <ContextMenu v-bind="{ x, y, xPlacement, yPlacement }">
        <ContextMenuItem v-if="!showSelection || focused.length >= 1" @click="toggleSelect">
            {{ isFocusSelected ? 'Deselecteer' : 'Selecteer' }}
        </ContextMenuItem>
        <ContextMenuItem v-if="showSelection && !isAllSelected" @click="setSelectAll(true)">
            Selecteer alles
        </ContextMenuItem>
        <ContextMenuItem v-if="showSelection && isAllSelected" @click="setSelectAll(false)">
            Deselecteer alles
        </ContextMenuItem>
        <ContextMenuItem v-if="focused.length == 0">
            Kolommen
            <span slot="right" class="icon arrow-right-small" />
        </ContextMenuItem>

        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine :key="groupIndex+'-line'" />
            <ContextMenuItem v-for="(action, index) of actions" :key="groupIndex+'-'+index" @click="handleAction(action)">
                {{ action.name }}
                <span v-if="action.icon" slot="right" :class="'icon '+action.icon" />
            </ContextMenuItem>
        </template>
    </ContextMenu>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,Column,ContextMenu, ContextMenuItem, ContextMenuLine, Toast } from "@stamhoofd/components";
import { Component, Mixins, Prop } from "vue-property-decorator";

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
    @Prop({ default: 0 })
    x!: number;

    @Prop({ default: 0 })
    y!: number;

    @Prop()
    xPlacement?: string;

    @Prop()
    yPlacement?: string;

    /**
     * Act only on selection given here
     */
    @Prop({ default: () => [] })
    focused!: any[];

    @Prop({ required: true })
    table!: TableView<any>;

    @Prop({ required: true })
    actions: TableAction<any>[];

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

    toggleSelect() {
        this.table.showSelection = true

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
        return Object.values(
            this.actions
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
                    const group = acc[action.groupIndex];
                    if (!group) {
                        acc[action.groupIndex] = [action]
                    } else {
                        group.push(action);
                    }
                    return acc;
                }, {} as { [groupIndex: number]: TableAction<any>[] })
        );

    }
}
</script>
