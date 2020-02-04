<template>
    <div
        class="navigation-controller"
        :data-animation-type="animationType"
        :data-scroll-document="scrollDocument ? 'true' : 'false'"
    >
        <transition
            v-if="mainComponent"
            :name="transitionName"
            v-on:before-enter="beforeEnter"
            v-on:before-leave="beforeLeave"
            v-on:enter="enter"
            v-on:leave="leave"
            v-on:after-leave="afterLeave"
            v-on:after-enter="afterEnter"
            v-on:enter-cancelled="enterCancelled"
            v-bind:css="false"
        >
            <keep-alive>
                <FramedComponent
                    :root="mainComponent"
                    :name="mainComponent.key"
                    :key="mainComponent.key"
                    @push="push"
                    @pop="pop"
                    ref="child"
                ></FramedComponent>
            </keep-alive>
        </transition>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
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
    counter: number = 0;
    savedScrollPositions: number[] = [];
    nextScrollPosition: number = 0;
    previousScrollPosition: number = 0;

    @Prop()
    root!: ComponentWithProperties;

    @Prop({ default: false })
    scrollDocument!: boolean;

    @Prop({ default: "default" })
    animationType!: string;

    mounted() {
        this.root.key = this.counter++;
        this.mainComponent = this.root;
        console.log(this.mainComponent);
        this.components = [this.root];

        console.log("scroll document: " + this.scrollDocument);
    }

    freezeSize() {
        if (this.isModalRoot()) {
            return;
        }
        const el = this.$el as HTMLElement;

        console.log("Freeze size: " + el.offsetWidth + "x" + el.offsetHeight);

        el.style.width = el.offsetWidth + "px";
        el.style.height = el.offsetHeight + "px";
    }

    setSize(width: number, height: number) {
        if (this.isModalRoot()) {
            // Only resize if larger
            return;
        }
        const el = this.$el as HTMLElement;

        console.log("Set width: " + width);

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
        return this.scrollDocument;
    }

    getScrollElement(): HTMLElement {
        if (this.isModalRoot()) {
            return document.documentElement;
        }
        return ((this.$refs.child as FramedComponent).$el as HTMLElement).firstElementChild as HTMLElement;
    }

    push(component: ComponentWithProperties) {
        component.key = this.counter++;
        this.transitionName = this.animationType == "modal" ? "modal-push" : "push";

        // Save scroll position
        this.previousScrollPosition = this.getScrollElement().scrollTop;
        console.log("Saved scroll position: " + this.previousScrollPosition);
        this.savedScrollPositions.push(this.previousScrollPosition);
        this.nextScrollPosition = 0;

        // Save width and height

        this.freezeSize();

        // Make sure the transition name changed, so wait for a rerender
        Vue.nextTick(() => {
            this.components.push(component);
            this.mainComponent = component;
            this.$emit("didPush");
        });
    }

    pop() {
        if (this.components.length <= 1) {
            this.$emit("pop");
            return;
        }

        const componentRef = this.$refs.child as any;
        this.previousScrollPosition = this.getScrollElement().scrollTop;

        this.transitionName = this.animationType == "modal" ? "modal-pop" : "pop";

        console.log("Prepared previous scroll positoin: " + this.previousScrollPosition);

        Vue.nextTick(() => {
            this.freezeSize();
            this.components.splice(this.components.length - 1, 1);
            this.nextScrollPosition = this.savedScrollPositions.pop() as number;

            this.mainComponent = this.components[this.components.length - 1];
            this.$emit("didPop");

            // Remove popped component from memory
            setTimeout(() => {
                componentRef.$destroy();
            }, 400);
        });
    }

    beforeEnter(insertedElement: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }
        insertedElement.className = this.transitionName + "-enter";

        // Prevent blink
        // Reset styles
        /*insertedElement.style.top = "";
        insertedElement.style.position = "";
        insertedElement.style.overflow = "";
        insertedElement.style.height = "";
        insertedElement.style.marginBottom = "";
        insertedElement.style.transform = "";
        insertedElement.style.bottom = "";*/
    }

    beforeLeave(element: HTMLElement) {
        var current = this.previousScrollPosition;
        element.className = this.transitionName + "-leave";
        (element.firstElementChild as HTMLElement).scrollTop = current;
    }

    enter(element: HTMLElement, done) {
        if (this.transitionName == "none") {
            done();
            return;
        }

        const w = (element.firstChild as HTMLElement).offsetWidth;
        const h = (element.firstChild as HTMLElement).offsetHeight;
        console.log("Entered element size: " + w + "x" + h);
        var next = this.nextScrollPosition;
        // We need this animation frame! Else the browser will not be able to correctly animate translate 100%
        // due to the width and height not calculated correctly if it contains flex children
        requestAnimationFrame(() => {
            // Lock position if needed
            this.setSize(w, h);

            // Set initial position
            element.className = this.transitionName + "-enter";

            // Enable animation only in the next frame (to prevent animating to the initial frame)
            requestAnimationFrame(() => {
                element.className = this.transitionName + "-enter-active";

                // Start animation in the next frame
                requestAnimationFrame(() => {
                    (element.firstChild as HTMLElement).style.transform = "";
                    element.className = this.transitionName + "-enter-active " + this.transitionName + "-enter-to";

                    setTimeout(() => {
                        done();
                    }, 350);
                });
            });
        });
    }

    leave(element: HTMLElement, done) {
        console.log("leave");

        // Prevent blinking due to slow rerender after scrollTop changes
        // Create a clone and offset the clone first. After that, adjust the scroll position
        var current = this.previousScrollPosition;
        var next = this.nextScrollPosition;
        console.log("Set scroll position of leaving frame: " + current);

        //Vue.nextTick(() => {
        //Vue.nextTick(() => {
        var height = element.offsetHeight;
        // Adjust original

        //if (this.isModalRoot()) {
        // Still blinks sometimes in Safari (macOS only) if current > 0. So we combine the following
        // lines in one animation frame to prevent rerendering between them.

        requestAnimationFrame(() => {
            // Set initial position
            element.className = this.transitionName + "-leave";
            (element.firstElementChild as HTMLElement).scrollTop = current;

            requestAnimationFrame(() => {
                element.className = this.transitionName + "-leave-active";
                requestAnimationFrame(() => {
                    this.getScrollElement().scrollTop = next;

                    element.className = this.transitionName + "-leave-active " + this.transitionName + "-leave-to";

                    setTimeout(() => {
                        done();
                    }, 350);
                });
            });
        });
    }

    afterLeave(element: HTMLElement) {
        console.log("After leave");
        element.className = "";
    }

    afterEnter(element: HTMLElement) {
        this.unfreezeSize();
        console.log("After enter");
        element.className = "";

        // Search for scroll position here
        //this.getScrollElement().scrollTop = this.nextScrollPosition;
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
    overflow: hidden;
    position: relative;

    &[data-animation-type="modal"] {
        & > * {
            // Fix: apply this background color permanently, else it won't work during transition for some strange reason
            // background-color: rgba(0, 0, 0, 0.7);
        }
    }

    &[data-scroll-document="false"] {
        transition: width 0.35s, height 0.35s;
    }

    &[data-animation-type="default"] {
        & > * {
            overflow: hidden;
        }
    }

    > .modal {
        &-push {
            &-enter-active {
                & > div {
                    transition: transform 0.35s;
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
                overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;

                & > div {
                    overflow: hidden !important;
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
                    transition: transform 0.35s;
                }
            }

            &-leave,
            &-leave-active {
                position: absolute;
                z-index: 10000;

                // During leave animation, the div inside this container will transition to the left, causing scroll offsets
                // We'll need to ignore these
                overflow: hidden !important;
                top: 0px;
                left: 0px;
                right: 0px;
                bottom: 0px;
                & > div {
                    overflow: hidden !important;
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
            transition: opacity 0.35s;

            & > div {
                transition: transform 0.35s;
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
            overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;

            & > div {
                overflow: hidden !important;
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
            transition: opacity 0.35s;

            & > div {
                transition: transform 0.35s;
            }
        }

        &-enter,
        &-enter-active {
            position: relative;
        }

        &-leave,
        &-leave-active {
            position: absolute;
            overflow: hidden !important;
            top: 0px;
            left: 0px;
            right: 0px;
            bottom: 0px;

            & > div {
                overflow: hidden !important;
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

    &[data-scroll-document="true"] {
        > .pop,
        > .push,
        > .modal-pop,
        > .modal-push {
            &-leave,
            &-leave-active {
                position: fixed;
            }
        }
    }
}
</style>
