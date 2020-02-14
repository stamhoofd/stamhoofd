<template>
    <div class="split-view-controller">
        <div class="master">
            <NavigationController
                ref="navigationController"
                :scroll-document="false"
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

    mounted() {
        window.addEventListener("resize", () => {
            if (window.innerWidth < 600) {
                if (this.detail) {
                    this.collapse();
                }
            } else {
                if (this.lastIsDetail && !this.detail) {
                    this.expand();
                }
            }
        });
    }

    get lastIsDetail() {
        return this.detailKey != null && this.navigationController.mainComponent.key == this.detailKey;
    }

    showDetail(component: ComponentWithProperties) {
        if (this.lastIsDetail || this.detail) {
            console.warn("Showing detail when a detail is already presented");
        }

        this.detailKey = component.key;

        if (window.innerWidth < 600) {
            this.navigationController.push(component);
        } else {
            this.detail = component;
        }
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

<style scoped lang="scss">
// This should be @use, but this won't work with webpack for an unknown reason? #bullshit
@use '~scss/layout/split-inputs.scss';
@use '~scss/base/text-styles.scss';
@use '~scss/components/inputs.scss';
@use '~scss/components/buttons.scss';

.split-view-controller {
    display: flex;
    height: 100vh;
    background: $color-white-shade;

    & > .master {
        flex-basis: 340px;
        flex-grow: 0;
        flex-shrink: 0;

        &:last-child {
            background: $color-white;
            flex-basis: 100%;
        }
    }

    & > .detail {
        flex-grow: 1;
        background: $color-white;
        border-top-left-radius: $border-radius;
        border-bottom-left-radius: $border-radius;
        @extend .style-side-view-shadow;
    }
}
</style>
