<template>
    <div class="navigation-controller">
        <template>
            <transition
                v-if="mainComponent.component != 'none'"
                :name="transitionName"
                v-on:enter="enter"
                v-on:after-enter="afterEnter"
                v-on:enter-cancelled="enterCancelled"
            >
                <keep-alive>
                    <component
                        :name="mainComponent.key"
                        :key="mainComponent.key"
                        :is="mainComponent.component"
                        v-bind="mainComponent.properties"
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
    mainComponent: ComponentWithProperties = new ComponentWithProperties(
        "none",
        {}
    );
    transitionName: string = "none";
    counter: number = 0;

    @Prop()
    root!: ComponentWithProperties;

    mounted() {
        this.root.key = this.counter++;
        this.mainComponent = this.root;
        console.log(this.mainComponent);
        this.components = [this.root];
    }

    freezeSize() {
        const el = this.$el as HTMLElement;

        el.style.width = el.offsetWidth + "px";
        el.style.height = el.offsetHeight + "px";
    }

    setSize(width: number, height: number) {
        const el = this.$el as HTMLElement;

        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    unfreezeSize() {
        const el = this.$el as HTMLElement;

        el.style.width = "auto";
        el.style.height = "auto";
    }

    push(component: ComponentWithProperties) {
        component.key = this.counter++;
        this.transitionName = "push";
        this.freezeSize();
        this.components.push(component);
        this.mainComponent = component;
    }

    pop() {
        this.transitionName = "pop";
        this.freezeSize();
        this.components.splice(this.components.length - 1, 1);
        this.mainComponent = this.components[this.components.length - 1];
    }

    enter(element: HTMLElement) {
        Vue.nextTick(() => {
            this.setSize(element.offsetWidth, element.offsetHeight);
        });
    }

    afterEnter(element: HTMLElement) {
        this.unfreezeSize();
    }

    enterCancelled(element: HTMLElement) {
        this.unfreezeSize();
    }
}
</script>

<style lang="scss">
.navigation-controller {
    // Scrolling should happen inside the children!
    overflow: hidden;
    position: relative;
    transition: width 0.3s, height 0.3s;

    .push {
        &-enter-active,
        &-leave-active {
            position: absolute;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
        }

        &-leave-active {
            left: 0;
            top: 0;
            right: 0;
        }

        &-enter-active {
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
        &-leave-active {
            position: absolute;
            overflow: hidden !important;
            transition: opacity 0.3s, transform 0.3s;
        }

        &-leave-active {
            left: 0;
            top: 0;
            right: 0;
        }

        &-enter-active {
            left: 0;
            top: 0;
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
