<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />
            <ContextMenuItemView v-for="(action, index) of actions" :key="groupIndex+'-'+index" :context-menu-view="$refs.contextMenuView" :class="{'disabled': isDisabled(action), destructive: action.destructive}" :child-context-menu="getChildContextMenu(action)" @click="handleAction(action, $event)">
                <p>{{ action.name }}</p>
                <p v-if="action.description" class="description">
                    {{ action.description }}
                </p>

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
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';
import { Checkbox, ContextMenuItemView, ContextMenuLine, ContextMenuView, Toast } from '@stamhoofd/components';

import { TableAction, TableActionSelection } from './classes';

@Component({
    components: {
        ContextMenuView,
        ContextMenuItemView,
        ContextMenuLine,
        Checkbox,
    },
})
export default class TableActionsContextMenu extends VueComponent {
    @Prop({ required: true })
    actions: TableAction<any>[];

    @Prop({ default: () => {
        // Required to return a default method
        return () => {};
    } })
    onDismiss!: (() => void);

    /**
     * Act only on selection given here
     */
    @Prop({ default: () => [] })
    selection!: TableActionSelection<any>;

    isDisabled(action: TableAction<any>) {
        return action.isDisabled(this.hasSelection);
    }

    unmounted() {
        this.onDismiss();
    }

    get hasSelection() {
        return this.selection.markedRows.size > 0 || this.selection.markedRowsAreSelected === false;
    }

    get isSingleSelection() {
        return this.selection.markedRows.size === 1 && this.selection.markedRowsAreSelected === true;
    }

    handleAction(action: TableAction<any>, event) {
        if (this.isDisabled(action)) {
            return;
        }
        action.handle(this.selection)?.catch((e) => {
            console.error(e);
            Toast.fromError(e).show();
        });
    }

    get groupedActions() {
        // Group all actions based on their groupIndex property, sorted by groupIndex
        return this.actions
            .filter((action) => {
                if (!action.enabled) {
                    return false;
                }
                if (action.singleSelection && !this.isSingleSelection) {
                    return false;
                }

                if ((this as any).$isMobile && this.isDisabled(action)) {
                    // On mobile, hide disabled actions, because we don't have enough room
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.groupIndex !== b.groupIndex) {
                    return a.groupIndex - b.groupIndex;
                }
                return b.priority - a.priority;
            })
            .reduce((acc, action) => {
                const group = acc[acc.length - 1];
                if (group && group[0].groupIndex === action.groupIndex) {
                    group.push(action);
                }
                else {
                    acc.push([action]);
                }
                return acc;
            }, [] as TableAction<any>[][]);
    }

    getChildContextMenu(action: TableAction<any>) {
        if (action.childMenu) {
            return action.childMenu;
        }

        if (!action.hasChildActions) {
            return;
        }

        return new ComponentWithProperties(TableActionsContextMenu, {
            actions: action.getChildActions(),
            selection: this.selection,
        });
    }

    pop(popParents = false) {
        this.$refs.contextMenuView?.pop(popParents);
    }
}
</script>
