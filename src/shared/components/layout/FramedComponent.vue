<template>
    <!-- Element that will get displayed fixed left, top, right bottom during transitions -->
    <div>
        <!-- Element that will take over the document scroll position during transitions -->
        <div ref="scrollContainer">
            <!-- Actual content with padding -->
            <ComponentWithPropertiesInstance :component="root" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Ref } from "vue-property-decorator";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import ComponentWithPropertiesInstance from "./ComponentWithPropertiesInstance";

@Component({
    components: {
        ComponentWithPropertiesInstance,
    },
})
export default class FramedComponent extends Vue {
    @Prop()
    root!: ComponentWithProperties;

    @Ref()
    scrollContainer!: HTMLElement;

    pop(data) {
        this.$emit("pop", data);
    }

    push(data) {
        this.$emit("push", data);
    }
}
</script>
