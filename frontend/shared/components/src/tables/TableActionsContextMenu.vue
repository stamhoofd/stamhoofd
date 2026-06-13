<template>
    <ContextMenuView v-bind="$attrs" ref="contextMenuView">
        <template v-for="(actions, groupIndex) of groupedActions">
            <ContextMenuLine v-if="groupIndex > 0" :key="groupIndex+'-line'" />
            <ContextMenuItemView v-for="(action, index) of actions" :key="groupIndex+'-'+index" :context-menu-view="(contextMenuView as any)" :class="{'disabled': isDisabled(action), destructive: action.destructive}" :child-context-menu="getChildContextMenu(action)" @click="handleAction(action)">
                <template v-if="action.icon" #left>
                    <span :class="'icon tiny '+action.icon" />
                </template>

                <p data-testid="context-menu-item-title">
                    {{ action.name }}
                </p>
                <p v-if="action.description" class="description">
                    {{ action.description }}
                </p>

                <template v-if="action.hasChildActions" #right>
                    <span class="icon arrow-right-small" />
                </template>
            </ContextMenuItemView>
        </template>
    </ContextMenuView>
</template>

<script lang="ts" setup>
import ContextMenuItemView from '#overlays/ContextMenuItemView.vue';
import ContextMenuLine from '#overlays/ContextMenuLine.vue';
import ContextMenuView from '#overlays/ContextMenuView.vue';
import { Toast } from '#overlays/Toast.ts';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { computed, getCurrentInstance, onUnmounted, useTemplateRef } from 'vue';

import { useIsMobile } from '../hooks/useIsMobile';
import type { TableAction, TableActionSelection } from '#tables/classes/TableAction.ts';

const props = withDefaults(defineProps<{
    actions: TableAction<any>[];
    onDismiss?: (() => void);
    /**
     * Act only on selection given here
     */
    selection?: TableActionSelection<any>;
}>(), {
    onDismiss: () => {
        // Required to return a default method
        return () => {};
    },
    selection: () => [] as any,
});

const isMobile = useIsMobile();
const Self = getCurrentInstance()!.type;
const contextMenuView = useTemplateRef<InstanceType<typeof ContextMenuView>>('contextMenuView');

const hasSelection = computed(() => props.selection.markedRows.size > 0 || props.selection.markedRowsAreSelected === false);
const isSingleSelection = computed(() => props.selection.markedRows.size === 1 && props.selection.markedRowsAreSelected === true);

onUnmounted(() => {
    props.onDismiss();
});

function isDisabled(action: TableAction<any>) {
    return action.isDisabled(hasSelection.value, props.selection);
}

function handleAction(action: TableAction<any>) {
    if (isDisabled(action)) {
        return;
    }
    action.handle(props.selection)?.catch((e) => {
        console.error(e);
        Toast.fromError(e).show();
    });
}

const groupedActions = computed(() => {
    // Group all actions based on their groupIndex property, sorted by groupIndex
    return props.actions
        .filter((action) => {
            if (!action.enabled()) {
                return false;
            }
            if (action.singleSelection && !isSingleSelection.value) {
                return false;
            }

            if (isMobile && isDisabled(action)) {
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
});

function getChildContextMenu(action: TableAction<any>) {
    if (action.childMenu) {
        return action.childMenu;
    }

    if (!action.hasChildActions) {
        return;
    }

    return new ComponentWithProperties(Self, {
        actions: action.getChildActions(),
        selection: props.selection,
    });
}

function pop(popParents = false) {
    contextMenuView.value?.pop(popParents);
}

defineExpose({ pop });
</script>
