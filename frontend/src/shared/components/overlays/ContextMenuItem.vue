<template>
    <div class="context-menu-item" @click="onClick" :class="{ clicked: clicked }">
        <slot></slot>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component
export default class ContextMenuItem extends Vue {
    clicked: boolean = false;

    onClick(event) {
        if (this.clicked) {
            return;
        }
        // blink
        this.clicked = true;
        setTimeout(() => {
            this.clicked = false;

            setTimeout(() => {
                this.$emit("click", event);
                this.$parent.pop();
            }, 80);
        }, 80);
    }
}
</script>

<style lang="scss"></style>
