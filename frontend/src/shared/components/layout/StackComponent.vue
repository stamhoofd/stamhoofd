<template>
    <div>
        <ComponentWithPropertiesInstance
            v-for="(component, index) in components"
            :key="component.key"
            @pop="removeAt(index, component.key)"
            ref="children"
            :component="component"
        ></ComponentWithPropertiesInstance>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import ComponentWithPropertiesInstance from "./ComponentWithPropertiesInstance";

@Component({
    components: {
        ComponentWithPropertiesInstance
    }
})
export default class StackComponent extends Vue {
    components: ComponentWithProperties[] = [];

    show(component: ComponentWithProperties) {
        this.components.push(component);
    }

    removeAt(index, key) {
        if (this.components[index].key === key) {
            this.components.splice(index, 1);
        } else {
            console.warn("Expected component with key " + key + " at index" + index);
        }
    }

    beforeDestroy() {
        this.components = [];
    }
}
</script>
