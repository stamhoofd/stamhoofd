<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />
            <ContextMenuItemView v-for="(action, index) of actions" :key="groupIndex+'-'+index" :context-menu-view="$refs.contextMenuView" :class="{'disabled': isDisabled(action)}" :child-context-menu="getChildContextMenu(action)" @click="handleAction(action, $event)">
                {{ action.name }}
                <template v-if="action.hasChildActions" #right>
                    <span class="icon arrow-right-small" />
                </template>
                <template v-else-if="action.icon" #right>
                    <span :class="'icon '+action.icon" />
                </template>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView, Toast } from "@stamhoofd/components";

import { TableAction, TableActionSelection } from "./classes";

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox
    },
})
export default class TableActionsContextMenu extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        actions: TableAction<any>[];

    @Prop({ default: () => {
        // Required to return a default method
        return () => {}
    } })
        onDismiss!: (() => void);

    /**
     * Act only on selection given here
     */
    @Prop({ default: () => [] })
        selection!: TableActionSelection<any>

    isDisabled(action: TableAction<any>) {
        return action.isDisabled(this.hasSelection)
    }

    unmounted() {
        this.onDismiss()
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

                if ((this as any).$isMobile && this.isDisabled(action)) {
                    // On mobile, hide disabled actions, because we don't have enough room
                    return false
                }
                return true
            })
            .sort((a, b) => {
                if (a.groupIndex !== b.groupIndex) {
                    return a.groupIndex - b.groupIndex
                }
                return b.priority - a.priority
            })
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
            selection: this.selection
        })
    }
}
</script>
