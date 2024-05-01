<template>
    <draggable v-if="draggable && false" v-model="list" item-key="id" handle=".drag" tag="div" class="st-list" :class="{'is-dragging': dragging}" animation="200" ghost-class="is-dragging" :group="group" :force-fallback="true" @start="onStart" @end="onEnd">
        <template #item="slotProps">
            <slot name="item" v-bind="slotProps" />
        </template>
    </draggable>
    <transition-group v-else-if="withAnimation" tag="div" name="list" class="st-list">
        <slot />
    </transition-group>
    <div v-else class="st-list">
        <slot />
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";
import draggable from 'vuedraggable'

@Component({
    components: {
        draggable
    },
    compatConfig: {
        MODE: 3,
    }
})
export default class STList extends Vue {
    @Prop({ default: null })
        valueModel!: any[] | null

    @Prop({ default: false })
        draggable!: boolean;

    @Prop({ default: undefined })
        group!: string | undefined;

    @Prop({ default: false })
        withAnimation!: boolean;

    dragging = false;

    get list() {
        return this.valueModel;
    }

    set list(changed: any[] | null) {
        this.$emit('update:modelValue', changed);
    }

    onStart() {
        this.dragging = true;
    }

    onEnd(event) {
        // On firefox we need to cancel all click events that happen after a drag
        // otherwise it will click one of the elements that was dragged

        setTimeout(() => {
            this.dragging = false;
        }, 100)
    }
}
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
            transition: transform 0.2s;
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