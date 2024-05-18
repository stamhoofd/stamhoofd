<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div>
        <ComponentWithPropertiesInstance :component="root" :key="root.key" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";
import { isReactive } from "vue";

@Component({
    components: {
        ComponentWithPropertiesInstance,
    },
    provide() {
        if (isReactive(this.context)) {
            // If this.context is a proxy, it will auto unwrap all the reference properties it has
            // which will break reactivity on scalar values (e.g. Computed<null> will be unwrapped to null)
            throw new Error('ContextProvider.context is reactive, which will break reactivity of the context properties')
        }

        return this.context;
    }
})
export default class ContextProvider extends Vue {
    @Prop()
        root!: ComponentWithProperties

    @Prop({default: () => {
        return {}
    }})
        context!: Record<string, unknown>

    async shouldNavigateAway() {
        return await this.root.shouldNavigateAway()
    }

    returnToHistoryIndex() {
        if (this.root) {
            return this.root.returnToHistoryIndex()
        }
        return false;
    }

    beforeMount() {
        if (this.root) {
            this.root.assignHistoryIndex()
        }
    }
}
</script>
