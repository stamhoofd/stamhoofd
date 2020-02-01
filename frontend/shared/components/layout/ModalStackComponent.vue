<template>
    <transition-group
        tag="div"
        name="fade"
        v-on:after-enter="afterEnter"
        v-on:before-enter="beforeEnter"
        class="modal-stack"
    >
        <div
            class="modal"
            v-for="component in components"
            @click="removeAt(component.key)"
            :key="component.key"
            :data-hide="component.hide"
            :modal-type="component.type"
        >
            <div @click.stop="">
                <component
                    :is="component.component"
                    v-bind="component.properties"
                    @dismiss="removeAt(component.key)"
                ></component>
            </div>
        </div>
    </transition-group>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import Modal from "@shared/components/layout/Modal.vue";

@Component
export default class ModalStackComponent extends Vue {
    components: ComponentWithProperties[] = [];
    listener: EventBusListener | null = null;
    counter: number = 0;

    show(component: ComponentWithProperties) {
        component.type = this.components.length <= 0 ? "normal" : "normal";
        component.key = this.counter++;
        this.components.push(component);
    }

    beforeEnter(insertedElement) {
        // Manually set position fixed during animation, so we kan keep it one tick longer
        insertedElement.setAttribute("data-extended-enter", "true");
    }

    afterEnter(insertedElement) {
        console.log("Updated hide");
        this.updateHidden();

        if (insertedElement.getAttribute("modal-type") == "normal") {
            // Restore scroll position
            window.scrollTo(0, 0);
        }

        // Manually remove the fixed position
        console.log("After enter");
        console.log(insertedElement);
        window.setTimeout(() => {
            insertedElement.removeAttribute("data-extended-enter");
        }, 200);
    }

    updateHidden() {
        var found = false;
        for (let index = this.components.length - 1; index >= 0; index--) {
            const element = this.components[index];
            if (found) {
                element.hide = true;
                continue;
            }
            if (element.type == "normal") {
                found = true;
            }
            element.hide = false;
        }
    }

    removeAt(key) {
        console.log("Dismiss");

        for (let index = this.components.length - 1; index >= 0; index--) {
            const element = this.components[index];
            if (element.key == key) {
                this.components.splice(index, 1);
                this.updateHidden();
                return;
            }
        }

        console.error("Not found!");
    }

    mounted() {
        this.listener = eventBus.listen("show-modal", this.show.bind(this));
    }

    beforeDestroy() {
        eventBus.removeListener(this.listener);
        this.listener = null;
        this.components = [];
    }

    get visibleComponents() {
        return this.components.filter(component => {
            return !component.hide;
        });
    }
}
</script>

<style lang="scss">
.modal-stack {
    position: relative;
}
.modal {
    &[modal-type="popup"] {
        // DO NOT ADD MAX HEIGHT HERE! Always add it to the children of the navigation controllers!
        background: rgba(black, 0.7);
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;

        // Improve performance
        will-change: transform;

        & > div {
            max-width: 800px;
            flex-basis: 100%;
            background: white;
            border-radius: 5px;

            & > * {
                max-height: 100vh;
                max-height: calc(var(--vh, 1vh) * 100);
                overflow-y: auto;
                transition: width 0.3s, height 0.3s;

                // Remove scroll blinks
                will-change: scroll-position;
            }

            overflow-y: auto;
            box-sizing: border-box;
        }
    }

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
