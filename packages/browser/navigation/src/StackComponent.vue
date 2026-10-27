<template>
    <div class="stack-component">
        <TransitionGroup name="show" :duration="300">
            <ComponentWithPropertiesInstance
                v-for="(component, index) in children"
                :key="component.key"
                :component="component"
                :custom-provide="getCustomProvide(index, component.key)"
            />
        </TransitionGroup>
    </div>
</template>

<script lang="ts" setup>

import { onBeforeUnmount, provide, type Ref, ref } from 'vue';

import { ComponentWithProperties } from './ComponentWithProperties';
import ComponentWithPropertiesInstance from './ComponentWithPropertiesInstance.js';
import { useFocused } from './utils/navigationHooks.js';

const children = ref([]) as Ref<ComponentWithProperties[]>;
const parentIsFocused = useFocused();
const emit = defineEmits(['returnToHistoryIndex']);

// Disable inheriting history index from parents (not related since it is overlayed - unless explicitly assigned a history index)
provide('navigation_historyIndex', null);
provide('navigation_parent', null);
provide('reactive_navigation_url', null);
provide('reactive_navigation_disable_url', null);

function getCustomProvide(index: number, key: number) {
    return {
        reactive_navigation_pop: () => {
            removeAt(index, key);
        },
        reactive_navigation_can_pop: true,
        reactive_navigation_dismiss: () => {
            console.warn('Avoid calling dismiss in components on the StackComponent, since options are not supported here');
            removeAt(index, key);
        },
        reactive_navigation_can_dismiss: false,
        reactive_navigation_focused: parentIsFocused.value && getFocusedComponent() === children.value[index],
    };
}

function removeAt(index: number, key: number) {
    if (!children.value[index]) {
        // Manually search for the key (timing conditions with slow events in vue)
        for (const [i, comp] of children.value.entries()) {
            if (comp.key === key) {
                console.warn('Corrected index from ' + index + ' to ' + i);
                index = i;
                break;
            }
        }
    }
    if (children.value[index] !== undefined && children.value[index].key === key) {
        const hadFocus = children.value[index].hasHistoryIndex(); // need to check for history index otherwise well falsely return the history index to a possible wrong view
        children.value.splice(index, 1);

        if (hadFocus) {
            const newFocused = getComponentWithHistory();
            if (!newFocused) {
                // The normalModalStackComponent is visible again
                emit('returnToHistoryIndex');
            }
            else {
                newFocused.returnToHistoryIndex();
            }
        }
    }
    else {
        console.warn('Expected component with key ' + key + ' at index ' + index);
    }
}

function getComponentWithHistory() {
    for (let i = children.value.length - 1; i >= 0; i--) {
        if (children.value[i].hasHistoryIndex() && !children.value[i].isDismissing.value) {
            return children.value[i];
        }
    }

    return null;
}
function getFocusedComponent() {
    for (let i = children.value.length - 1; i >= 0; i--) {
        if (children.value[i].canHaveFocus() && !children.value[i].isDismissing.value) {
            return children.value[i];
        }
    }

    return null;
}

function show(component: ComponentWithProperties) {
    children.value.push(component);
}

onBeforeUnmount(() => {
    children.value = [];
});

defineExpose({
    show,
    getFocusedComponent,
    removeAt,
    children,
});
</script>
