<template>
    <div>
        <component
            v-for="(component, index) in components"
            :key="component.key"
            :is="component.component"
            v-bind="component.properties"
            @remove="removeAt(index, component.key)"
        ></component>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

@Component
export default class StackComponent extends Vue {
    components: ComponentWithProperties[] = [];
    listener: EventBusListener | null = null;
    counter: number = 0;

    show(component: ComponentWithProperties) {
        component.key = this.counter++;
        this.components.push(component);
    }

    removeAt(index, key) {
        if (this.components[index].key === key) {
            this.components.splice(index, 1);
        }
    }

    mounted() {
        this.listener = eventBus.listen("show", this.show.bind(this));
    }

    beforeDestroy() {
        eventBus.removeListener(this.listener);
        this.listener = null;
        this.components = [];
    }
}
</script>