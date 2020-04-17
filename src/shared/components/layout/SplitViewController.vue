<template>
    <div class="split-view-controller" :data-has-detail="detail ? 'true' : 'false'">
        <div ref="masterElement" class="master">
            <NavigationController ref="navigationController" :root="root" @showDetail="showDetail" />
        </div>
        <div v-if="detail" class="detail">
            <FramedComponent ref="detailFrame" :key="detail.key" :root="detail" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Ref } from "vue-property-decorator";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import NavigationController from "./NavigationController.vue";
import FramedComponent from "./FramedComponent.vue";

// Credits https://codeburst.io/throttling-and-debouncing-in-javascript-b01cad5c8edf
const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

@Component({
    components: {
        NavigationController,
        FramedComponent,
    },
    props: {
        root: ComponentWithProperties,
    },
})
export default class SplitViewController extends Vue {
    @Prop()
    root!: ComponentWithProperties;
    detail: ComponentWithProperties | null = null;

    @Ref()
    navigationController!: NavigationController;

    @Ref()
    detailKeepAlive!: Vue; // = KeepAlive internal class

    @Ref()
    masterElement!: HTMLElement; // = KeepAlive internal class

    detailKey: number | null = null;

    activated() {
        (this as any).listener = throttle(this.onResize, 200);
        window.addEventListener("resize", (this as any).listener, { passive: true } as EventListenerOptions);
    }

    deactivated() {
        window.removeEventListener("resize", (this as any).listener, { passive: true } as EventListenerOptions);
    }

    onResize() {
        if (this.shouldCollapse()) {
            if (this.detail) {
                this.collapse();
            }
        } else {
            if (this.lastIsDetail && !this.detail) {
                this.expand();
            }
        }
    }

    get lastIsDetail() {
        return (
            this.detailKey != null &&
            (this.$refs.navigationController as NavigationController).mainComponent.key == this.detailKey
        );
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

    showDetail(component: ComponentWithProperties) {
        this.detailKey = component.key;

        if (this.shouldCollapse()) {
            if (this.lastIsDetail || this.detail) {
                console.error("Pusing a detail when a detail is already presented is not allowed");
                return;
            }

            this.navigationController.push(component);
        } else {
            // Replace existing detail component
            this.getScrollElement().scrollTop = 0;
            this.detail = component;
        }
    }

    shouldCollapse() {
        return (this.$el as HTMLElement).offsetWidth < 800;
    }

    collapse() {
        if (this.lastIsDetail) {
            console.error("Cannot collapse when the detail is already collaped");
            return;
        }
        this.detail.keepAlive = true;
        const detail = this.detail;
        this.detail = null;
        this.navigationController.push(detail, false);
    }

    expand() {
        if (this.detail) {
            console.error("Cannot expand when detail is already visible");
            return;
        }
        if (!this.lastIsDetail) {
            console.error("Cannot expand when there is no detail");
            return;
        }
        const popped = this.navigationController.pop(false, false);

        // We need to wait until it is removed from the vnode
        this.$nextTick(() => {
            this.detail = popped;
        });
    }
}
</script>

<style lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

.split-view-controller {
    background: $color-white-shade;
    position: relative;
    width: 100%;
    box-sizing: border-box;

    & > .master {
        flex-shrink: 0;
        flex-grow: 0;
        position: sticky;
        left: 0;
        top: 0;
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);

        overflow: hidden;
        overflow-y: scroll;
        -webkit-overflow-scrolling: touch;

        // do not start scrolling parents if we reached the edge of this view
        // we'll need to add a polyfill for Safari in JS to disable overscroll (currently not available)
        overscroll-behavior-y: contain;

        &:last-child {
            position: relative;
            overflow: visible;
            width: 100%;
            height: auto;
        }
    }

    & > .detail {
        background: $color-white;
        border-top-left-radius: $border-radius;
        border-bottom-left-radius: $border-radius;

        // Clip contents (during animations)
        // Sometimes not working on iOS (need to fix)
        // clip-path: inset(0px 0px);

        @extend .style-side-view-shadow;
    }

    // Make sure our background color etc fills the whole view
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);

    &[data-has-detail="true"] {
        display: grid;
        grid-template-columns: 320px 1fr;

        & > .detail {
            min-height: 100vh;
            min-height: calc(var(--vh, 1vh) * 100);
        }
    }
}
</style>
