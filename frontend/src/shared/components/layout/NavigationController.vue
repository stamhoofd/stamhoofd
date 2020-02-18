<template>
    <div
        class="navigation-controller"
        :data-animation-type="animationType"
        :data-scroll-document="scrollDocument ? 'true' : 'false'"
    >
        <transition
            v-if="mainComponent"
            v-on:before-enter="beforeEnter"
            v-on:before-leave="beforeLeave"
            v-on:enter="enter"
            v-on:leave="leave"
            v-on:after-leave="afterLeave"
            v-on:after-enter="afterEnter"
            v-on:enter-cancelled="enterCancelled"
            v-bind:css="false"
        >
            <!--<keep-alive>-->
            <FramedComponent
                :root="mainComponent"
                :name="mainComponent.key"
                :key="mainComponent.key"
                @push="push"
                @show="push"
                @pop="pop"
                ref="child"
            ></FramedComponent>
            <!--</keep-alive>-->
        </transition>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Ref } from "vue-property-decorator";
import { eventBus } from "../../classes/event-bus/EventBus";
import { PresentComponentEvent } from "../../classes/PresentComponentEvent";
import { EventBusListener } from "../../classes/event-bus/EventBusListener";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import FramedComponent from "./FramedComponent.vue";

@Component({
    components: {
        FramedComponent
    }
})
export default class NavigationController extends Vue {
    components: ComponentWithProperties[] = [];
    mainComponent: ComponentWithProperties | null = null;
    transitionName: string = "none";
    savedScrollPositions: number[] = [];
    nextScrollPosition: number = 0;
    previousScrollPosition: number = 0;

    @Prop()
    root!: ComponentWithProperties;

    @Prop({ default: false })
    scrollDocument!: boolean;

    @Prop({ default: "default" })
    animationType!: string;

    @Ref()
    child!: FramedComponent;

    mounted() {
        this.mainComponent = this.root;
        this.components = [this.root];
    }

    freezeSize() {
        if (this.isModalRoot()) {
            //return;
        }
        const el = this.$el as HTMLElement;

        console.log("Freeze size: " + el.offsetWidth + "x" + el.offsetHeight);

        el.style.width = el.offsetWidth + "px";
        el.style.height = el.offsetHeight + "px";
    }

    setSize(width: number, height: number) {
        if (this.isModalRoot()) {
            // Only resize if larger
            //return;
        }
        const el = this.$el as HTMLElement;

        console.log("Set height: " + height);

        if (!this.isModalRoot() && height >= window.innerHeight) {
            // Respect max height + improve animation durations
            el.style.height = "100vh";
            el.style.height = "calc(var(--vh, 1vh) * 100)";
        } else {
            el.style.height = height + "px";
        }

        el.style.width = width + "px";
    }

    unfreezeSize() {
        if (this.isModalRoot()) {
            //el.style.width = "auto";
            //el.style.height = "auto";
            //return;
        }
        const el = this.$el as HTMLElement;
        el.style.width = "";
        el.style.height = "";
        if (this.isModalRoot()) {
            //el.style.width = "auto";
            //el.style.height = "auto";
            return;
        }

        //el.style.width = "auto";
        //el.style.height = "auto";
    }

    isModalRoot(): boolean {
        return true;
    }

    getScrollElement(element: HTMLElement | null = null): HTMLElement {
        if (!element) {
            element = this.$el as HTMLElement;
        }

        const style = window.getComputedStyle(element);
        if (
            style.overflowY == "scroll" ||
            style.overflow == "scroll" ||
            style.overflow == "auto" ||
            style.overflowY == "auto"
        ) {
            return element;
        } else {
            if (!element.parentElement) {
                return document.documentElement;
            }
            return this.getScrollElement(element.parentElement);
        }
    }

    push(component: ComponentWithProperties, animated: boolean = true) {
        if (!animated) {
            this.transitionName = "none";
        } else {
            this.transitionName = this.animationType == "modal" ? "modal-push" : "push";
        }

        // Save scroll position
        this.previousScrollPosition = this.getScrollElement().scrollTop;
        console.log("Saved scroll position: " + this.previousScrollPosition);
        this.savedScrollPositions.push(this.previousScrollPosition);
        this.nextScrollPosition = 0;

        // Save width and height

        this.freezeSize();

        // Make sure the transition name changed, so wait for a rerender
        this.components.push(component);

        if (this.mainComponent) {
            // Keep the component alive while it is removed from the DOM
            this.mainComponent.keepAlive = true;
        }

        this.mainComponent = component;
        this.$emit("didPush");
    }

    pop(animated: boolean = true, destroy: boolean = true): ComponentWithProperties | null {
        if (this.components.length <= 1) {
            this.$emit("pop");
            return null;
        }

        this.previousScrollPosition = this.getScrollElement().scrollTop;

        if (!animated) {
            this.transitionName = "none";
        } else {
            this.transitionName = this.animationType == "modal" ? "modal-pop" : "pop";
        }
        console.log("Prepared previous scroll positoin: " + this.previousScrollPosition);

        this.freezeSize();
        const popped = this.components.splice(this.components.length - 1, 1);

        if (!destroy) {
            // Stop destroy
            popped[0].keepAlive = true;
        }

        this.nextScrollPosition = this.savedScrollPositions.pop() as number;

        this.mainComponent = this.components[this.components.length - 1];
        this.$emit("didPop");

        return popped[0];
    }

    beforeEnter(insertedElement: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }

        // We need to set the class already to hide the incoming element
        insertedElement.className = this.transitionName + "-enter-active " + this.transitionName + "-enter";
    }

    beforeLeave(element: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }
        // Do nothing here. Is is important to finish the enter transitions first!
        // Do not even set a class! That will cause flickering on Webkit!
    }

    enter(element: HTMLElement, done) {
        if (this.transitionName == "none") {
            this.getScrollElement().scrollTop = this.nextScrollPosition;
            done();
            return;
        }

        const scrollElement = this.getScrollElement();

        const w = ((element.firstChild as HTMLElement).firstChild as HTMLElement).offsetWidth;
        const h = (element.firstChild as HTMLElement).offsetHeight;
        const next = this.nextScrollPosition;

        // Lock position if needed
        // This happens before the beforeLeave animation frame!
        this.setSize(w, h);

        // Disable scroll during animation (this is to fix overflow elements)
        // We can only allow scroll during transitions when all browser support overflow: clip, which they don't atm
        // This sometimes doesn't work on iOS Safari on body due to a bug
        scrollElement.style.overflow = "hidden";

        requestAnimationFrame(() => {
            // Wait and execute immediately after beforeLeave's animation frame
            // Let the OS rerender once so all the positions are okay after dom insertion
            scrollElement.scrollTop = next;

            // Start animation in the next frame
            requestAnimationFrame(() => {
                // We've reached our initial positioning and can start our animation
                element.className = this.transitionName + "-enter-active " + this.transitionName + "-enter-to";

                setTimeout(() => {
                    scrollElement.style.overflow = "";

                    done();
                }, 1000);
            });
        });
    }

    leave(element: HTMLElement, done) {
        if (this.transitionName == "none") {
            done();
            return;
        }

        // Prevent blinking due to slow rerender after scrollTop changes
        // Create a clone and offset the clone first. After that, adjust the scroll position
        var current = this.previousScrollPosition;
        var next = this.nextScrollPosition;

        const scrollElement = this.getScrollElement();

        // we add some extra padding below to fix iOS bug that reports wront clientHeight
        // We need to show some extra area below of the leaving frame, but to do this, we also need
        // to add padding in order to adjust the scrollTop (without reaching it's maximum value)
        const fixPadding = 300;
        const h = scrollElement.clientHeight + fixPadding;
        var height = h + "px";

        console.log("Client height: " + scrollElement.clientHeight);
        console.log("Offset height: " + scrollElement.offsetHeight);

        if (scrollElement === document.documentElement) {
            // iOS fix: clientHeight is too small
            //height = "200px";
        }

        // This animation frame is super important to prevent flickering on Safari and Webkit!
        // This is also one of the reasons why we cannot use the default Vue class additions
        // We do this to improve the timing of the classes and scroll positions
        requestAnimationFrame(() => {
            // Setting the class has to happen in one go.
            // First we need to make our element fixed / absolute positioned, and pinned to all the edges
            // In the same frame, we need to update the scroll position.
            // If we switch the ordering, this won't work!
            element.className = this.transitionName + "-leave-active " + this.transitionName + "-leave";

            element.style.top = next + "px";
            element.style.height = height;
            element.style.bottom = "auto";
            element.style.overflow = "hidden";

            // Now scroll!
            (element.firstElementChild as HTMLElement).style.overflow = "hidden";
            (element.firstElementChild as HTMLElement).style.height = h - fixPadding + "px";
            (element.firstElementChild as HTMLElement).style.paddingBottom = fixPadding + "px";

            (element.firstElementChild as HTMLElement).scrollTop = current;

            debugger;

            requestAnimationFrame(() => {
                // We've reached our initial positioning and can start our animation
                element.className = this.transitionName + "-leave-active " + this.transitionName + "-leave-to";

                setTimeout(() => {
                    element.style.overflow = "";
                    (element.firstElementChild as HTMLElement).style.overflow = "";
                    element.style.top = "";
                    element.style.height = "";
                    element.style.bottom = "";

                    done();
                }, 1000);
            });
        });
    }

    afterLeave(element: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }

        element.className = "";
    }

    afterEnter(element: HTMLElement) {
        this.unfreezeSize();

        if (this.transitionName == "none") {
            return;
        }

        element.className = "";
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
    overflow: visible;
    position: relative;
    //height: 100%;

    //transform: translate3d(0, 0, 0);

    &[data-animation-type="modal"] {
        & > * {
            // Fix: apply this background color permanently, else it won't work during transition for some strange reason
            // background-color: rgba(0, 0, 0, 0.7);
        }
    }

    &[data-scroll-document="false"] {
        transition: width 1s, height 1s;
    }

    &[data-animation-type="default"] {
        & > * {
            //overflow: hidden;
        }
    }

    > .modal {
        &-push {
            &-enter-active {
                & > div {
                    transition: transform 1s;
                }
            }

            &-enter,
            &-enter-active {
                position: relative;

                & > div {
                    min-height: 100vh;
                    min-height: calc(var(--vh, 1vh) * 100);
                    background: white;
                }
            }

            &-leave,
            &-leave-active {
                position: absolute;

                // During leave animation, the div inside this container will transition to the left, causing scroll offsets
                // We'll need to ignore these
                //overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;

                & > div {
                    //overflow: hidden !important;
                    width: 100%;
                    height: 100%;
                }
            }

            &-enter {
                & > div {
                    transform: translateY(100vh);
                }
            }
        }

        &-pop {
            &-leave-active {
                & > div {
                    transition: transform 1s;
                }
            }

            &-leave,
            &-leave-active {
                position: absolute;
                z-index: 10000;

                // During leave animation, the div inside this container will transition to the left, causing scroll offsets
                // We'll need to ignore these
                //overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;
                & > div {
                    //overflow: hidden !important;
                    background: white;
                    width: 100%;
                    height: 100%;
                }
            }

            &-enter,
            &-enter-active {
                position: relative;
            }

            &-leave-to {
                & > div {
                    transform: translateY(100vh);
                }
            }
        }
    }

    > .push {
        &-enter-active,
        &-leave-active {
            transition: opacity 1s;

            & > div {
                transition: transform 1s;
            }
        }

        &-enter,
        &-enter-active {
            position: relative;
        }

        &-leave,
        &-leave-active {
            position: absolute;

            // During leave animation, the div inside this container will transition to the left, causing scroll offsets
            // We'll need to ignore these
            //overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;

            // Top, left and bottom will get adjusted

            & > div {
                //overflow: hidden !important;
                width: 100%;
                height: 100%;
            }
        }

        &-enter, &-leave-to /* .fade-leave-active below version 2.1.8 */ {
            opacity: 0;
        }

        &-enter {
            & > div {
                transform: translateX(100%);
            }
        }

        &-leave-to {
            & > div {
                transform: translateX(-100%);
            }
        }
    }

    > .pop {
        &-enter-active,
        &-leave-active {
            transition: opacity 1s;

            & > div {
                transition: transform 1s;
            }
        }

        &-enter,
        &-enter-active {
            position: relative;
        }

        &-leave,
        &-leave-active {
            position: absolute;
            //overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;

            & > div {
                //overflow: hidden !important;
                width: 100%;
                height: 100%;
            }
        }

        &-enter, &-leave-to /* .fade-leave-active below version 2.1.8 */ {
            opacity: 0;
        }

        &-enter {
            & > div {
                transform: translateX(-100%);
            }
        }

        &-leave-to {
            & > div {
                transform: translateX(100%);
            }
        }
    }

    > * {
        height: 100%;

        > * {
            height: 100%;
        }
    }

    /*&[data-scroll-document="true"] {
        > .pop,
        > .push,
        > .modal-pop,
        > .modal-push {
            &-leave,
            &-leave-active {
                //position: fixed;
            }
        }
    }

    &[data-scroll-document="false"] {
        & > * > * {
            overflow: hidden;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;

            // do not start scrolling parents if we reached the edge of this view
            overscroll-behavior-y: contain;
            // we'll add a polyfill for Safari in JS to disable overscroll
        }
    }*/
}
</style>
