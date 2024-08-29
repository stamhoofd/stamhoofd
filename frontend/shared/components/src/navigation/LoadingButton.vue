<template>
    <div class="loading-button" :class="{loading}">
        <div><slot /></div>
        <div>
            <Spinner v-if="loading || delayLoading" />
        </div>
    </div>
</template>


<script lang="ts">
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";

import Spinner from "../Spinner.vue";

@Component({
    components: {Spinner}
})
export default class LoadingButton extends VueComponent {
    @Prop({ default: false, type: Boolean })
    loading!: boolean;

    // Remove the spinner animation from the dom to save some resources of the browser
    delayLoading = false


    @Watch('loading')
    onValueChanged(val: boolean, old: boolean) {
        if (!val && old) {
            this.delayLoading = true
            setTimeout(() => {
                this.delayLoading = false
            }, 500)
        } else {
            if (val) {
                this.delayLoading = true;
            }
        }
    }
}
</script>

<style lang="scss">

.loading-button {
    position: relative;
    display: inline-block;

    &.block {
        display: block;
    }

    &.bottom {
        margin-top: auto;
        padding-top: 15px;
    }

    > div:first-child {
        transition: transform 0.3s;
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }

    > div:last-child {
        position: absolute;
        opacity: 0;
        top: 50%;
        left: 50%;
        width: 24px;
        height: 24px;
        transition: opacity 0.3s;
        contain: strict;
        transform: translate(-50%, -50%);

        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    &.loading {
        > div:first-child {
            opacity: 0.2;
        }
        > div:last-child {
            opacity: 1;
        }
    }
}
</style>
