<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent :root="root"></ModalStackComponent>

        <!-- To display temporary messages, popups and everything that covers other modals-->
        <StackComponent></StackComponent>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Steps from "./components/Steps.vue";
import ModalStackComponent from "stamhoofd-shared/components/layout/ModalStackComponent.vue";
import { eventBus } from "stamhoofd-shared/classes/event-bus/EventBus";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";
import StackComponent from "stamhoofd-shared/components/layout/StackComponent.vue";

@Component({
    components: {
        Steps,
        ModalStackComponent,
        StackComponent
    }
})
export default class App extends Vue {
    public root = new ComponentWithProperties(Steps, {});

    mounted() {}
}
</script>

<style lang="scss">
@use "stamhoofd-shared/scss/base/reset.scss";
@use "stamhoofd-shared/scss/base/text-styles.scss";
@use "stamhoofd-shared/scss/elements/body.scss";
@use "stamhoofd-shared/scss/components/logo.scss";

body {
}
</style>
