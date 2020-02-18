<template>
    <div>
        <component
            v-for="(component, index) in components"
            :key="component.key"
            ref="children"
            :is="component.component"
            v-bind="component.properties"
            @pop="removeAt(index, component.key)"
        ></component>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

@Component
export default class StackComponent extends Vue {
    components: ComponentWithProperties[] = [];
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

    beforeDestroy() {
        this.components = [];
    }
}
</script>
