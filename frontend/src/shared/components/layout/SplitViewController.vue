<template>
    <div class="split-view-controller">
        <div class="master">
            <NavigationController
                ref="navigationController"
                :scroll-document="!detail"
                :root="root"
                @showDetail="showDetail"
            ></NavigationController>
        </div>
        <div class="detail" v-if="detail">
            <FramedComponent :key="detail.key" :root="detail"></FramedComponent>
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

    detailKey: number | null = null;

    scrollDocument: boolean = true;

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

    showDetail(component: ComponentWithProperties) {
        if (this.lastIsDetail || this.detail) {
            console.warn("Showing detail when a detail is already presented");
        }

        this.detailKey = component.key;

        if (this.shouldCollapse()) {
            this.navigationController.push(component);
        } else {
            if (this.scrollDocument) {
                document.documentElement.scrollTop = 0;
            }
            this.detail = component;
        }
    }

    shouldCollapse() {
        return window.innerWidth < 600;
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
    overflow: hidden;
    position: relative;
    padding-left: 320px;

    & > .master {
        position: fixed;
        left: 0;
        top: 0;
        max-height: 100vh;
        max-height: calc(var(--vh, 1vh) * 100);
        width: 320px;

        &:last-child {
            position: relative;
            width: auto;
        }
    }

    & > .detail {
        min-height: 100vh;
        min-height: calc(var(--vh, 1vh) * 100);

        background: $color-white;
        border-top-left-radius: $border-radius;
        border-bottom-left-radius: $border-radius;
        @extend .style-side-view-shadow;
    }
}

body {
    background-color: $color-white-shade;
}
</style>
