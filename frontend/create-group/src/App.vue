<template>
    <div id="app">
        <ModalStackComponent></ModalStackComponent>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Steps from "./components/Steps.vue";
import ModalStackComponent from "@shared/components/layout/ModalStackComponent.vue";
import { eventBus } from "stamhoofd-shared/classes/event-bus/EventBus";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";

@Component({
    components: {
        Steps,
        ModalStackComponent
    }
})
export default class App extends Vue {
    mounted() {
        eventBus.send("show-modal", new ComponentWithProperties(Steps, {}));
    }
}
</script>

<style lang="scss">
@use "~@shared/scss/base/reset.scss";
@use "~@shared/scss/base/text-styles.scss";
@use "~@shared/scss/elements/body.scss";
@use "~@shared/scss/components/logo.scss";

body {
}
</style>
