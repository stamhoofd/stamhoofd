<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent :root="root" />

        <!-- To display temporary messages, popups and everything that covers other modals-->
        <StackComponent />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import ModalStackComponent from "@stamhoofd/shared/components/layout/ModalStackComponent.vue";
import StackComponent from "@stamhoofd/shared/components/layout/StackComponent.vue";
import { Component, Vue } from "vue-property-decorator";

import Steps from "./components/Steps.vue";

@Component({
    components: {
        Steps,
        ModalStackComponent,
        StackComponent,
    },
})
export default class App extends Vue {
    public root = new ComponentWithProperties(Steps, {});
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "scss/base/reset.scss";
@use "scss/base/text-styles.scss";
@use "scss/elements/body.scss";
@use "scss/components/logo.scss";
</style>
