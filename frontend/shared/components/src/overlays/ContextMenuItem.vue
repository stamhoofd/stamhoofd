<template>
    <component :is="elementName" class="context-menu-item" type="button" @click.passive="onClick">
        <div class="left">
            <slot name="left" />
        </div>
        <div class="middle">
            <slot />
        </div>
        <div class="right">
            <slot name="right" />
        </div>
    </component>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class ContextMenuItem extends Vue {
    clicked = false;

    @Prop({ default: 'button', type: String })
    elementName!: string;

    onClick(event) {
        if (this.clicked) {
            return;
        }
        this.clicked = true
        this.$emit("click", event);

        // Allow some time to let the browser handle some events (e.g. label > update checkbox)
        setTimeout(() => {
            (this.$parent as any).pop();
        }, 80)
    }
}
</script>