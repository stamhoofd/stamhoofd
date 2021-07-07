<template>
    <transition name="fade" appear>
        <div class="st-view loading-view">
            <Spinner class="center gray" />
        </div>
    </transition>
</template>


<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

import Spinner from "../Spinner.vue";

@Component({
    components: {
        Spinner
    }
})
export default class LoadingView extends Vue {
}
</script>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;
@use '~@stamhoofd/scss/base/text-styles';

.loading-view {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 12;
    opacity: 1;
    background: var(--color-current-background, #{$color-white});

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        transition: opacity 0.2s 1s;

    }
    
    &.fade-enter-active {
        transition: opacity 0.2s;

        > .spinner-container {
            transition: opacity 0.2s 1s;
        }
    }

    &.fade-leave-active {
        transition: opacity 0.2s;

        > .spinner-container {
            transition: opacity 0.2s 1s;
        }
    }

    &.fade-enter /* .fade-leave-active below version 2.1.8 */ {
        > .spinner-container {
            opacity: 0;
        }
    }

    &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
    }
}
</style>
