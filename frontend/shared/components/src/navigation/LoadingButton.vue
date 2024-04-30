<template>
    <div class="loading-button" :class="{loading}">
        <div><slot /></div>
        <div>
            <Spinner v-if="loading || delayLoading" />
        </div>
    </div>
</template>


<script lang="ts">
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

import Spinner from "../Spinner.vue";

@Component({
    components: {Spinner}
})
export default class LoadingButton extends Vue {
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
        transform: translate(0px, 0px);
    }

    > div:last-child {
        position: absolute;
        opacity: 0;
        top: 50%;
        right: 0;
        width: 30px;
        height: 30px;
        transform: translate(30px, -50%);
        transition: transform 0.3s, opacity 0.3s;
        contain: strict;

        display: flex;
        align-items: center;
        justify-content: flex-end;
    }

    &.loading {
        > div:first-child {
            transform: translate(-39px, 0);
        }
        > div:last-child {
            opacity: 1;
            transform: translate(0px, -50%);
        }
    }
}
</style>
