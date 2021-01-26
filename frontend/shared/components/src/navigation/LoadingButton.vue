<template>
    <div class="loading-button" :class="{loading}">
        <div><slot /></div>
        <div>
            <Spinner v-if="loading || delayLoading"/>
        </div>
    </div>
</template>


<script lang="ts">
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

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
            }, 300)
        }
    }
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles';

.loading-button {
    position: relative;
    display: inline-block;

    &.block {
        display: block;
    }

    > div:first-child {
        padding-right: 0px;
        transition: padding-right 0.25s;
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }

     > div:last-child {
        position: absolute;
        opacity: 0;
        top: 50%;
        right: 0;
        transform: translate(100%, -50%);
        transition: transform 0.25s, opacity 0.25s;
    }

    &.loading {
        > div:first-child {
            padding-right: 40px;
        }
        > div:last-child {
            opacity: 1;
            transform: translate(0, -50%);
        }
    }
}
</style>
