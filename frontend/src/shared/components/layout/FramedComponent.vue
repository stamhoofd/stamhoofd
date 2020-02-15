<template>
    <!-- Element that will get displayed fixed left, top, right bottom during transitions -->
    <div>
        <!-- Element that will take over the document scroll position during transitions -->
        <div ref="scrollContainer">
            <!-- Actual content with padding -->
            <ComponentWithPropertiesInstance :component="root"></ComponentWithPropertiesInstance>
            <!--<component
                :name="root.key"
                :key="root.key"
                :is="root.component"
                v-bind="root.properties"
                ref="component"
                @push="push"
                @pop="pop"
            ></component>-->
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Ref } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import ComponentWithPropertiesInstance from "./ComponentWithPropertiesInstance";

@Component({
    components: {
        ComponentWithPropertiesInstance
    }
})
export default class NavigationController extends Vue {
    @Prop()
    root!: ComponentWithProperties;

    @Ref()
    scrollContainer!: HTMLElement;

    mounted() {}
    pop(data) {
        this.$emit("pop", data);
    }

    push(data) {
        this.$emit("push", data);
    }
}
</script>
