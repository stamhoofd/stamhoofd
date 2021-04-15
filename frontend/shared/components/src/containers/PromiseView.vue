<template>
    <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
    <LoadingView v-else />
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Logger } from '@stamhoofd/logger';
import { Component, Mixins,Prop, Vue } from "vue-property-decorator";

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

    run() {
        this.promise.call(this).then((value) => {
           this.root = value
        }).catch(e => {
            Logger.error(e)
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