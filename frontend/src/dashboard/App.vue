<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent v-if="stop" :root="root"></ModalStackComponent>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import ModalStackComponent from "shared/components/layout/ModalStackComponent.vue";
import { eventBus } from "shared/classes/event-bus/EventBus";
import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import StackComponent from "shared/components/layout/StackComponent.vue";
import SplitViewController from "../shared/components/layout/SplitViewController.vue";
import Menu from "./components/Menu.vue";

@Component({
    components: {
        ModalStackComponent,
        StackComponent
    }
})
export default class App extends Vue {
    public root = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(Menu, {})
    });
    public stop: boolean = true;

    mounted() {
        /*setTimeout(() => {
            this.root.keepAlive = true;
            this.stop = false;

            setTimeout(() => {
                this.stop = true;
            }, 5000);
        }, 5000);*/
    }
}
</script>

<style lang="scss">
@use "scss/base/reset.scss";
@use "scss/base/text-styles.scss";
@use "scss/elements/body.scss";
@use "scss/components/logo.scss";

body {
}
</style>
