<template>
    <div id="app">
        <StackComponent></StackComponent>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import Steps from "./components/Steps.vue";
import StackComponent from "@shared/components/layout/StackComponent.vue";
import { eventBus } from "stamhoofd-shared/classes/event-bus/EventBus";
import { ComponentWithProperties } from "stamhoofd-shared/classes/ComponentWithProperties";

@Component({
    components: {
        Steps,
        StackComponent
    }
})
export default class App extends Vue {
    mounted() {
        eventBus.send("show", new ComponentWithProperties(Steps, {}));
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
