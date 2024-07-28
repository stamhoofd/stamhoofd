<template>
    <Sortable v-if="draggable" :list="listModel" :item-key="itemKey" tag="div" class="st-list" :class="{'is-dragging': isDrag}" :options="options" @start="onStart" @update="onUpdate">
        <template #item="{element, index}">
            <slot name="item" v-bind="{item: element, index}" />
        </template>
    </Sortable>
    <TransitionGroup v-else-if="withAnimation" tag="div" name="list" class="st-list">
        <slot />
    </TransitionGroup>
    <div v-else class="st-list">
        <slot />
    </div>
</template>

<script setup lang="ts" generic="T">
import { SortableEvent, SortableOptions } from "sortablejs";
import { Sortable } from "sortablejs-vue3"
import { computed, nextTick, ref } from 'vue';

const props = withDefaults(
    // props
    defineProps<{
        draggable?: boolean, 
        group?: string, 
        withAnimation?: boolean, 
        itemKey?: string | ((item: any) => string | number | symbol)
    }>(),
    // default values
    {
        valueModel: null, 
        draggable: false, 
        group: undefined, 
        withAnimation: false, 
        itemKey: 'id'
    }
);

const listModel =defineModel<T[] | undefined>({default: undefined});

const options = computed<SortableOptions>(() => { return {
    animation: 200,
    group: props.group,
    handle: '.drag',
    ghostClass: 'is-dragging',
    forceFallback: true,
}});

const isDrag = ref(false);

const onStart = () => {
    isDrag.value = true;
};

const onUpdate = async ({from, to, oldIndex, newIndex, ...event}: SortableEvent) => {
    if (from !== to) {
        console.warn('Dragged between lists, not supported', from, to, event);

        // On firefox we need to cancel all click events that happen after a drag
        // otherwise it will click one of the elements that was dragged

        setTimeout(() => {
            isDrag.value = false;
        }, 100)
        return;
    }

    if(listModel.value !== undefined) {
        if(oldIndex !== undefined && newIndex !== undefined) {
            listModel.value = await moveItemInArray(listModel.value, oldIndex, newIndex);
        }
    }

    // On firefox we need to cancel all click events that happen after a drag
    // otherwise it will click one of the elements that was dragged

    setTimeout(() => {
        isDrag.value = false;
    }, 100)
};

const moveItemInArray = async <T>(array: T[], from: number, to: number) => {
    const copy = [...array];
    const item = copy.splice(from, 1)[0];
    
    return await nextTick(() => {
        copy.splice(to, 0, item);
        return copy});
};
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.st-list {
    padding: 0;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

    .st-list > & {
        // Allow stacking if we need partial draggable area
        margin: 0;
    }

    > .st-list-item {        
        &.list-move {
            transition: transform 0.2s, opacity 0.2s;
        }

        &.list-enter-active,
        &.list-leave-active {
            transition: transform 0.2s, opacity 0.2s;
        }

        &.list-enter-from,
        &.list-leave-to {
            opacity: 0;
            transform: translateX(30px);
        }

        &.list-leave-active {
            position: absolute;
            }

        &.is-dragging {
            .middle, .right, .left {
                visibility: hidden;
            }
        }

        &.sortable-drag {
            opacity: 0.8 !important;
            cursor: grabbing !important;
        }
    }


    +.style-button-bar {
        margin-top: 15px;
    }

    .icon.drag {
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }


    &.is-dragging {
        * {
            cursor: grabbing !important;
        }
    }
   

}
</style>
