<template>
    <draggable v-if="draggable" v-model="list" handle=".drag" tag="div" class="st-list" animation="200" ghost-class="is-dragging" :group="group" :force-fallback="true">
        <slot />
    </draggable>
    <transition-group v-else-if="withAnimation" tag="div" name="list" class="st-list">
        <slot />
    </transition-group>
    <div v-else class="st-list">
        <slot />
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import draggable from 'vuedraggable'

@Component({
    components: {
        draggable
    }
})
export default class STList extends Vue {
    @Prop({ default: null })
    value!: any[] | null

    @Prop({ default: false })
    draggable!: boolean;

    @Prop({ default: undefined })
    group!: string | undefined;

    @Prop({ default: false })
    withAnimation!: boolean;

    get list() {
        return this.value;
    }

    set list(changed: any[] | null) {
        this.$emit('input', changed);
    }
}
</script>

<style lang="scss">
.st-list {
    padding: 0;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

    > .st-list-item {
        &.list-move {
            transition: transform 0.2s;
        }

        &.is-dragging {
            .middle, .right, .left {
                visibility: hidden;
            }
        }
    }
        

}
</style>