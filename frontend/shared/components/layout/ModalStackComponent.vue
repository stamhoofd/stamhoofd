<template>
    <!-- Components taking up the whole document. Listens to show-modal -->
    <NavigationController
        :scroll-document="true"
        ref="navigationController"
        :root="root"
    ></NavigationController>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import Modal from "@shared/components/layout/Modal.vue";
import NavigationController from "./NavigationController.vue";

@Component({
    components: {
        NavigationController
    }
})
export default class ModalStackComponent extends Vue {
    @Prop()
    readonly root!: ComponentWithProperties;

    listener: EventBusListener | null = null;
    counter: number = 0;

    show(component: ComponentWithProperties) {
        if (component.component === NavigationController) {
            component.properties.scrollDocument = true;
        }
        this.$refs.navigationController.push(component);
    }

    mounted() {
        this.listener = eventBus.listen("show-modal", this.show.bind(this));
    }

    beforeDestroy() {
        eventBus.removeListener(this.listener);
    }
}
</script>

<style lang="scss">
.modal-stack {
    position: relative;
}
.modal {
    &.fade-enter-active,
    &.fade-leave-active,
    &[data-extended-enter="true"] {
        position: fixed;
        transition: opacity 0.3s;

        & > div {
            transition: opacity 0.3s, transform 0.3s;
        }
    }
    &.fade-enter, &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;

        & > div {
            transform: translate(0, 50vh);
        }
    }

    &.fade-enter-active,
    &.fade-leave-active {
        z-index: 10000;
    }

    &[modal-type="normal"] {
        padding: 0px;
        display: block;
        position: relative;
        background: white;

        &.fade-enter-active,
        &.fade-leave-active,
        &[data-extended-enter="true"] {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;

            // During animatoin: min height
            min-height: 100vh;
            min-height: calc(var(--vh, 1vh) * 100);
        }

        & > div {
            border-radius: 0;
            max-width: none;
            max-height: none;
            width: 100%;
            height: 100%;

            & > .navigation-controller {
                width: 100% !important;
            }
        }
    }

    &[data-hide="true"] {
        position: absolute;
        z-index: -1;
        visibility: hidden;
        left: 0;
        right: 0;
        top: 0;
    }
}
</style>
