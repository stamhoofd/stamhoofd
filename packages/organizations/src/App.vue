<template>
    <div id="app">
        <!-- To display things that cover everything else and require document scrolling on mobile -->
        <ModalStackComponent :root="root" />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import ModalStackComponent from "@stamhoofd/shared/components/layout/ModalStackComponent.vue";
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import StackComponent from "@stamhoofd/shared/components/layout/StackComponent.vue";
import SplitViewController from "@stamhoofd/shared/components/layout/SplitViewController.vue";
import Menu from "./views/dashboard/Menu.vue";

@Component({
    components: {
        ModalStackComponent,
        StackComponent,
    },
})
export default class App extends Vue {
    public root = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(Menu, {}),
    });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/reset.scss";
@use "@stamhoofd/scss/base/text-styles.scss";
@use "@stamhoofd/scss/elements/body.scss";
@use "@stamhoofd/scss/components/logo.scss";
</style>
