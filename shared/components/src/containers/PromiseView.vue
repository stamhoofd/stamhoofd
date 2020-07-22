<template>
    <ComponentWithPropertiesInstance v-if="root" :component="root" :key="root.key" />
    <LoadingView v-else />
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue, Mixins } from "vue-property-decorator";

import LoadingView from "./LoadingView.vue"

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingView
    },
})
export default class PromiseView extends Mixins(NavigationMixin) {
    @Prop({required: true})
    promise: () => Promise<ComponentWithProperties>

    root: ComponentWithProperties | null = null

    mounted() {
        this.run()
    }

    activated() {
        console.log("activated promise view")
        console.log(this.root)
    }

    run() {
        this.promise.call(this).then((value) => {
           this.root = value
        }).catch(e => {
            console.error(e);
            console.error("Promise error not caught, defaulting to dismiss behaviour in PromiseView")
            this.dismiss({ force: true });
        })
    }

    reload() {
        this.root = null;
        this.run();
    }

    async shouldNavigateAway(): Promise<boolean> {
        if (!this.root) {
            return true;
        }
        return await (this.root.shouldNavigateAway());
    }
}
</script>