<template>
    <div class="navigation-controller">
        <template>
            <transition
                v-if="mainComponent"
                :name="transitionName"
                v-on:before-enter="beforeEnter"
                v-on:enter="enter"
                v-on:leave="leave"
                v-on:after-leave="afterLeave"
                v-on:after-enter="afterEnter"
                v-on:enter-cancelled="enterCancelled"
            >
                <keep-alive>
                    <component
                        :name="mainComponent.key"
                        :key="mainComponent.key"
                        :is="mainComponent.component"
                        v-bind="mainComponent.properties"
                        :data-transition-name="transitionName"
                        @push="push"
                        @pop="pop"
                    ></component>
                </keep-alive>
            </transition>
        </template>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";

@Component
export default class NavigationController extends Vue {
    components: ComponentWithProperties[] = [];
    mainComponent: ComponentWithProperties | null = null;
    transitionName: string = "none";
    counter: number = 0;
    savedScrollPositions: number[] = [];
    nextScrollPosition: number = 0;

    @Prop()
    root!: ComponentWithProperties;

    mounted() {
        this.root.key = this.counter++;
        this.mainComponent = this.root;
        console.log(this.mainComponent);
        this.components = [this.root];
    }

    freezeSize() {
        if (this.isModalRoot()) {
            return;
        }
        const el = this.$el as HTMLElement;

        el.style.width = el.offsetWidth + "px";
        el.style.height = el.offsetHeight + "px";
    }

    setSize(width: number, height: number) {
        if (this.isModalRoot()) {
            return;
        }
        const el = this.$el as HTMLElement;

        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    unfreezeSize() {
        if (this.isModalRoot()) {
            return;
        }
        const el = this.$el as HTMLElement;

        el.style.width = "auto";
        el.style.height = "auto";
    }

    isModalRoot(): boolean {
        return (
            (((this.$el as HTMLElement).parentElement as HTMLElement)
                .parentElement as HTMLElement).getAttribute("modal-type") ==
            "normal"
        );
    }

    getScrollElement(): HTMLElement {
        if (this.isModalRoot()) {
            return document.documentElement;
        }
        return this.$el as HTMLElement;
    }

    push(component: ComponentWithProperties) {
        component.key = this.counter++;
        this.transitionName = "push";

        // Save scroll position
        const scrollPosition = this.getScrollElement().scrollTop;
        console.log("Saved scroll position: " + scrollPosition);
        this.savedScrollPositions.push(scrollPosition);
        this.nextScrollPosition = 0;

        // Save width and height

        this.freezeSize();
        this.components.push(component);
        this.mainComponent = component;
    }

    pop() {
        if (this.components.length <= 1) {
            this.$emit("dismiss");
            return;
        }
        this.transitionName = "pop";
        this.freezeSize();
        this.components.splice(this.components.length - 1, 1);
        this.nextScrollPosition = this.savedScrollPositions.pop() as number;

        this.mainComponent = this.components[this.components.length - 1];
    }

    beforeEnter(insertedElement: HTMLElement) {
        // Manually set position fixed during animation, so we kan keep it one tick longer
        insertedElement.setAttribute("data-extended-enter", "true");
    }

    enter(element: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }
        Vue.nextTick(() => {
            this.setSize(element.offsetWidth, element.offsetHeight);
        });
    }

    leave(element: HTMLElement) {
        var current = this.getScrollElement().scrollTop;
        var next = this.nextScrollPosition;
        // prettier-ignore
        element.style.top = (next - current) + "px";

        this.getScrollElement().scrollTop = next;
    }

    afterLeave(element: HTMLElement) {
        element.style.top = "";
    }

    afterEnter(element: HTMLElement) {
        this.unfreezeSize();
        console.log("After enter");

        // Search for scroll position here
        //this.getScrollElement().scrollTop = this.nextScrollPosition;

        window.setTimeout(() => {
            element.removeAttribute("data-extended-enter");
        }, 2000);
    }

    enterCancelled(element: HTMLElement) {
        this.unfreezeSize();
    }

    beforeDestroy() {
        console.log("Destroyed navigation controller");
        // Prevent memory issues by removing all references
        this.components = [];
        this.mainComponent = null;
    }
}
</script>

<style lang="scss">
.navigation-controller {
    // Scrolling should happen inside the children!
    overflow: hidden; // Should be visible because some elements inside will all become absolute, causing the height of the navigation controller to collapse, but they still need to stay visible
    overflow-y: auto;
    max-height: 100vh;
    position: relative;
    transition: width 0.3s, height 0.3s;

    .push {
        &-enter-active,
        *[data-transition-name="push"][data-extended-enter="true"] {
            position: relative;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
        }

        &-leave-active {
            position: absolute;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
            left: 0;
            top: 0;
            right: 0;
        }

        &-enter, &-leave-to /* .fade-leave-active below version 2.1.8 */ {
            opacity: 0;
        }

        &-enter {
            transform: translateX(100%);
        }

        &-leave-to {
            transform: translateX(-100%);
        }
    }

    .pop {
        &-enter-active,
        *[data-transition-name="pop"][data-extended-enter="true"] {
            position: relative;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
        }

        &-leave-active {
            position: absolute;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
            left: 0;
            top: 0; // Will get adjusted based on scroll position earlier
            right: 0;
        }

        &-enter, &-leave-to /* .fade-leave-active below version 2.1.8 */ {
            opacity: 0;
        }

        &-enter {
            transform: translateX(-100%);
        }

        &-leave {
            transform: translateX(0);
        }

        &-leave-to {
            transform: translateX(100%);
        }
    }
}
</style>
