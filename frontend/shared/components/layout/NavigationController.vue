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
            //return;
        }
        const el = this.$el as HTMLElement;

        el.style.width = el.offsetWidth + "px";
        el.style.height = el.offsetHeight + "px";
    }

    setSize(width: number, height: number) {
        const el = this.$el as HTMLElement;

        if (this.isModalRoot()) {
            // Only resize if larger
            if (height <= el.offsetHeight) {
                return;
            }
        }

        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    unfreezeSize() {
        if (this.isModalRoot()) {
            //return;
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
    }

    enter(element: HTMLElement) {
        if (this.transitionName == "none") {
            return;
        }
        console.log("Enter");
        Vue.nextTick(() => {
            console.log("Enter next tick");
            this.setSize(element.offsetWidth, element.offsetHeight);
        });
    }

    leave(element: HTMLElement) {
        console.log("leave");

        // Prevent blinking due to slow rerender after scrollTop changes
        // Create a clone and offset the clone first. After that, adjust the scroll position
        var current = this.getScrollElement().scrollTop;
        var next = this.nextScrollPosition;

        Vue.nextTick(() => {
            Vue.nextTick(() => {
                console.log("leave next tick");
                var height = element.offsetHeight;
                // Adjust original

                if (this.isModalRoot()) {
                    element.style.cssText =
                        "position: fixed; overflow: hidden; height: " +
                        height +
                        "px; top: " +
                        -current +
                        "px;";

                    setTimeout(() => {
                        Vue.nextTick(() => {
                            this.getScrollElement().scrollTop = next;
                        });
                    }, 10);
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
        element.style.top = "";
        element.style.position = "";
        element.style.overflow = "";
        element.style.height = "";
        element.style.marginBottom = "";

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

    > .push {
        &-enter-active {
            transition: opacity 0.3s;
            position: relative;

            & > div {
                //overflow: hidden !important;
                transition: transform 0.3s;
            }
        }

        &-leave-active {
            // Javascript will make this sticky later with a custom top offset

            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            transition: opacity 0.3s;

            & > div {
                transition: transform 0.3s;
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
            transition: opacity 0.3s;
            position: relative;

            & > div {
                //overflow: hidden !important;
                transition: transform 0.3s;
            }
        }

        &-leave-active {
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            transition: opacity 0.3s;

            & > div {
                transition: transform 0.3s;
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
