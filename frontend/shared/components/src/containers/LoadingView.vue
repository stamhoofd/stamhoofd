<template>
    <transition name="fade" mode="out-in" appear>
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
    position: relative;

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

    }
    
    &.fade-enter-active {
        > .spinner-container {
            transition: opacity 0s 0.2s;
        }
    }

    &.fade-leave-active {
        > .spinner-container {
            transition: opacity 0.2s;
        }
    }
    &.fade-enter, &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        > .spinner-container {
            opacity: 0;
        }
    }
}
</style>
