<template>
    <div
        class="split-view-controller"
        :data-scroll-document="scrollDocument ? 'true' : 'false'"
        :data-has-detail="detail ? 'true' : 'false'"
    >
        <div class="master" ref="masterElement">
            <NavigationController
                ref="navigationController"
                :scroll-document="true"
                :root="root"
                @showDetail="showDetail"
            ></NavigationController>
        </div>
        <div class="detail" v-if="detail">
            <FramedComponent ref="detailFrame" :key="detail.key" :root="detail"></FramedComponent>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Ref } from "vue-property-decorator";
import { ComponentWithProperties } from "../../classes/ComponentWithProperties";
import NavigationController from "./NavigationController.vue";
import FramedComponent from "./FramedComponent.vue";

@Component({
    components: {
        NavigationController,
        FramedComponent
    },
    props: {
        root: ComponentWithProperties
    }
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

    @Prop({ default: true })
    scrollDocument!: boolean;

    mounted() {
        window.addEventListener("resize", this.onResize, { passive: true } as EventListenerOptions);
    }

    destoyed() {
        window.removeEventListener("resize", this.onResize, { passive: true } as EventListenerOptions);
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
        return this.detailKey != null && this.navigationController.mainComponent.key == this.detailKey;
    }

    getScrollElement(): HTMLElement {
        if (this.scrollDocument || !this.$refs.detailFrame) {
            return document.documentElement;
        }
        return ((this.$refs.detailFrame as FramedComponent).$el as HTMLElement).firstElementChild as HTMLElement;
    }

    showDetail(component: ComponentWithProperties) {
        if (this.lastIsDetail || this.detail) {
            console.warn("Showing detail when a detail is already presented");
        }

        this.detailKey = component.key;

        if (this.shouldCollapse()) {
            this.navigationController.push(component);
        } else {
            this.getScrollElement().scrollTop = 0;

            if (this.scrollDocument) {
                // Disable body overflow
                //document.body.style.overflow = "hidden";
                // Todo: also transfer body scroll to navigation controller
            }

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

        if (this.scrollDocument) {
            // Reenable body overflow
            //document.body.style.overflow = "";
        }
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
            if (this.scrollDocument) {
                // Disable body overflow
                //document.body.style.overflow = "hidden";
            }
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
    //overflow: hidden;
    position: relative;
    padding-left: 320px;
    width: 100%;
    //height: 100%;
    box-sizing: border-box;

    & > .master {
        position: fixed;
        left: 0;
        top: 0;
        width: 320px;
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);

        overflow: hidden;
        overflow-y: scroll;
        -webkit-overflow-scrolling: touch;

        // do not start scrolling parents if we reached the edge of this view
        overscroll-behavior-y: contain;
        // we'll add a polyfill for Safari in JS to disable overscroll

        &:last-child {
            position: relative;
            overflow: visible;
            width: 100%;
            height: 100%;
        }
    }

    & > .detail {
        background: $color-white;
        border-top-left-radius: $border-radius;
        border-bottom-left-radius: $border-radius;
        width: 100%;
        //overflow: hidden;
        overflow: -moz-hidden-unscrollable;
        overflow: clip;
        clip-path: inset(0px 0px);

        @extend .style-side-view-shadow;
    }

    &[data-scroll-document="false"] {
        min-height: auto;
        height: 100%;

        & > .master {
            position: absolute;
            height: 100%;
        }

        & > .detail {
            overflow: hidden;
            overflow-y: scroll;
            -webkit-overflow-scrolling: touch;

            // do not start scrolling parents if we reached the edge of this view
            overscroll-behavior-y: contain;
            // we'll add a polyfill for Safari in JS to disable overscroll

            position: absolute;
            top: 0;
            left: 320px;
            bottom: 0;
            right: 0;
            width: auto;
        }
    }

    &[data-has-detail="true"][data-scroll-document="true"] {
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);

        & > .detail {
            min-height: 100vh;
            min-height: calc(var(--vh, 1vh) * 100);
        }
    }

    &[data-has-detail="false"] {
        padding-left: 0;
    }
}

body {
    //background-color: $color-white-shade;
    //overflow: hidden;
}
</style>
