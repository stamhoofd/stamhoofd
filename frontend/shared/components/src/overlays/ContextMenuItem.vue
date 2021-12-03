<template>
    <component :is="elementName" class="context-menu-item" :class="{ clicked: clicked }" @click="onClick">
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

    @Prop({ default: 'article', type: String })
    elementName!: string;

    onClick(event) {
        if (this.clicked) {
            return;
        }
        this.$emit("click", event);
        (this.$parent as any).pop();
    }
}
</script>