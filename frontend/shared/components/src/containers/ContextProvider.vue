<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div>
        <ComponentWithPropertiesInstance :component="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        ComponentWithPropertiesInstance,
    },
    provide() {
        return {
            ...this.context,
            ...this.calculatedContext()
        }
    }
})
export default class ContextProvider extends Vue {
    @Prop()
        root!: ComponentWithProperties

    @Prop()
        context!: Record<string, unknown>

    @Prop()
        calculatedContext!: () => Record<string, unknown>
}
</script>