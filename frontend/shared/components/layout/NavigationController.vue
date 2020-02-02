<template>
    <div class="navigation-controller" :data-animation-type="animationType">
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
            :duration="350"
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
            return;
        }
        const el = this.$el as HTMLElement;
        el.style.width = "auto";
        el.style.height = "auto";
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
        return this.$el as HTMLElement;
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
        this.components.push(component);
        this.mainComponent = component;
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

            // Remove popped component from memory
            setTimeout(() => {
                componentRef.$destroy();
            }, 15000);
        });
    }

    beforeEnter(insertedElement: HTMLElement) {
        // Reset styles

        insertedElement.style.top = "";
        insertedElement.style.position = "";
        insertedElement.style.overflow = "";
        insertedElement.style.height = "";
        insertedElement.style.marginBottom = "";
        insertedElement.style.transform = "";
        insertedElement.style.bottom = "";
    }

    beforeLeave(element: HTMLElement) {}

    enter(element: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }

        console.log("Enter");
        Vue.nextTick(() => {
            console.log("Enter next tick");
            this.setSize(
                (element.firstChild as HTMLElement).offsetWidth,
                (element.firstChild as HTMLElement).offsetHeight
            );
        });
    }

    leave(element: HTMLElement) {
        console.log("leave");

        // Prevent blinking due to slow rerender after scrollTop changes
        // Create a clone and offset the clone first. After that, adjust the scroll position
        var current = this.previousScrollPosition;
        var next = this.nextScrollPosition;
        console.log("Set scroll position of leaving frame: " + current);

        Vue.nextTick(() => {
            Vue.nextTick(() => {
                console.log("leave next tick");
                var height = element.offsetHeight;
                // Adjust original

                if (this.isModalRoot()) {
                    // Still blinks sometimes in Safari (macOS only) if current > 0. Need to find a way to combine the following
                    // two lines in one statement to prevent rerendering between them.
                    element.style.cssText = "position: fixed; overflow: hidden; top: 0px; bottom: 0px;";
                    (element.firstElementChild as HTMLElement).scrollTop = current;

                    setTimeout(() => {
                        Vue.nextTick(() => {
                            this.getScrollElement().scrollTop = next;
                        });
                    }, 50);

                    /*element.style.cssText =
                        "position: fixed; overflow: hidden; height: " + height + "px; top: " + -current + "px;";
                    this.getScrollElement().style.overflowY = "hidden";
                    setTimeout(() => {
                        Vue.nextTick(() => {
                            this.getScrollElement().scrollTop = next;
                            this.getScrollElement().style.overflowY = "scroll";
                        });
                    }, 10);*/
                } else {
                    this.getScrollElement().scrollTop = next;

                    element.style.cssText =
                        "position: absolute; overflow: hidden; height: " +
                        height +
                        "px;transform: translateY(" +
                        (next - current) +
                        "px); top: 0px;";
                }
                /*element.style.cssText =
                    "position: " +
                    (this.isModalRoot()
                        ? "fixed"
                        : "sticky; position: -webkit-sticky") +
                    "; overflow: visible; height: " +
                    height +
                    "px; margin-bottom: " +
                    -height +
                    "px;transform: translateY(" +
                    -current +
                    "px); top: 0px;";*/
            });
        });
    }

    afterLeave(element: HTMLElement) {
        console.log("After leave");
        element.style.top = "";
        element.style.position = "";
        element.style.overflow = "";
        element.style.height = "";
        element.style.marginBottom = "";
        element.style.bottom = "";

        element.style.transform = "";
    }

    afterEnter(element: HTMLElement) {
        this.unfreezeSize();
        console.log("After enter");

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
    overflow: visible;
    position: relative;

    &[data-animation-type="modal"] > * {
        // Fix: apply this background color permanently, else it won't work during transition for some strange reason
        // background-color: rgba(0, 0, 0, 0.7);
        & > div {
            // Will change scroll position of this one during transitions
            will-change: scroll-position;
        }
    }

    > .modal {
        &-push {
            &-enter-active {
                transition: opacity 0.35s;
                position: relative;
                overflow: hidden !important;

                & > div {
                    transition: transform 0.35s;
                }

                //transition: background-color 0.35s;
                overflow: hidden;
                & > div {
                    min-height: 100vh;
                    min-height: calc(var(--vh, 1vh) * 100);
                    background: white;
                    transition: transform 0.35s;
                }
            }

            &-enter {
                //background-color: rgba(0, 0, 0, 0) !important;
            }

            &-enter-to {
                //background-color: rgba(0, 0, 0, 0.7);
            }

            &-leave-active {
                // Javascript will make this fixed or absolute later with a custom top offset
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                overflow: hidden !important;

                & > div {
                    transition: transform 0.35s;
                }
            }

            &-enter {
                & > div {
                    transform: translateY(100vh);
                }
            }
        }

        &-pop {
            &-enter-active {
                position: relative;
                overflow: hidden !important;

                & > div {
                    transition: transform 0.35s;
                }

                z-index: -1;
            }

            &-leave-active {
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                transition: opacity 0.35s;
                overflow: hidden !important;

                & > div {
                    transition: transform 0.35s;
                }

                //transition: background-color 0.35s;
                //background-color: rgba(0, 0, 0, 0.7);
                & > div {
                    min-height: 100vh;
                    min-height: calc(var(--vh, 1vh) * 100);
                    background: white;
                    transition: transform 0.35s;
                }
            }

            &-leave {
                //background-color: rgba(0, 0, 0, 0.7);
            }

            &-leave-to {
                //background-color: rgba(0, 0, 0, 0);
                & > div {
                    transform: translateY(100vh);
                }
            }
        }
    }

    > .push {
        &-enter-active {
            transition: opacity 0.35s;
            position: relative;

            & > div {
                transition: transform 0.35s;
            }
        }

        &-leave-active {
            // Javascript will make this fixed or absolute later with a custom top offset
            position: absolute;
            left: 0;
            top: 0;
            right: 0;

            transition: opacity 0.35s;

            & > div {
                transition: transform 0.35s;
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
        &-enter-active {
            transition: opacity 0.35s;

            position: relative;

            & > div {
                transition: transform 0.35s;
            }
        }

        &-leave-active {
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            transition: opacity 0.35s;

            & > div {
                transition: transform 0.35s;
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
}
</style>
