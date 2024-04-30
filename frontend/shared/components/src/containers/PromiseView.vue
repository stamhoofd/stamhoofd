<template>
    <!-- This div is not really needed, but causes bugs if we remove it from the DOM. Probably something Vue.js related (e.g. user keeps logged out, even if loggedIn = true and force reload is used) -->
    <div>
        <ComponentWithPropertiesInstance v-if="root" :key="root.key" :component="root" />
        <LoadingView v-else key="promiseLoadingView" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, ComponentWithPropertiesInstance,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Prop, Vue, toNative } from 'vue-facing-decorator'

import LoadingView from "./LoadingView.vue"

@Component({
    components: {
        ComponentWithPropertiesInstance,
        LoadingView
    },
    mixins: [NavigationMixin]
})
export class PromiseView extends Vue {
    @Prop({required: true})
    promise: () => Promise<ComponentWithProperties>

    root: ComponentWithProperties | null = null

    created() {
        this.run()
    }
    
    run() {
        this.promise.call(this).then((value) => {
            // We need to make a copy, or we risk having the same component twice in the DOM
            this.root = value.clone()
        }).catch(e => {
            console.error(e)
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

export default toNative(PromiseView)
</script>