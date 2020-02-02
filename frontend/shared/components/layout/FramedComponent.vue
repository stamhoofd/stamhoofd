<template>
    <!-- Element that will get displayed fixed left, top, right bottom during transitions -->
    <div>
        <!-- Element that will take over the document scroll position during transitions -->
        <div style="overflow: hidden; background: white;">
            <!-- Actual content with padding -->
            <component
                :name="root.key"
                :key="root.key"
                :is="root.component"
                v-bind="root.properties"
                @push="push"
                @pop="pop"
            ></component>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

@Component
export default class NavigationController extends Vue {
    @Prop()
    root!: ComponentWithProperties;

    pop(data) {
        this.$emit("pop", data);
    }

    push(data) {
        this.$emit("push", data);
    }
}
</script>
