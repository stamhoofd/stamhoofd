<template>
    <div class="split-view-controller">
        <div class="master">
            <NavigationController
                ref="navigationController"
                :scroll-document="false"
                :root="root"
                @showDetail="showDetail"
            ></NavigationController>

            <button
                class="button primary"
                v-if="!detail && navigationController && navigationController.components.length > 1"
                @click="expand"
            >
                Expand
            </button>
        </div>
        <div class="detail" v-if="detail">
            <FramedComponent :key="detail.key" :root="detail"></FramedComponent>
            <button class="button primary" v-if="detail" @click="collapse">Collapse</button>
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
    counter: number = 0;

    showDetail(component: ComponentWithProperties) {
        component.key = this.counter++;
        this.detail = component;
    }

    collapse() {
        console.log(this.detailKeepAlive);

        this.detail.keepAlive = true;
        const detail = this.detail;
        this.detail = null;
        this.navigationController.push(detail, false);
    }

    expand() {
        if (this.detail) {
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
    height: 500px;

    & > .master {
        flex-basis: 40%;
        flex-shrink: 0;
        flex-grow: 0;
    }

    & > .detail {
    }
}
</style>
