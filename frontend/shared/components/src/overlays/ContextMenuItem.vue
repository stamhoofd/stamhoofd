<template>
    <div class="context-menu-item" :class="{ clicked: clicked }" @click="onClick">
        <div class="middle">
            <slot />
        </div>
        <div class="right">
            <slot name="right" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class ContextMenuItem extends Vue {
    clicked = false;

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
                (this.$parent as any).pop();
            }, 80);
        }, 80);
    }
}
</script>