<template>
    <transition name="fade" mode="out-in" appear>
        <div class="loading-view">
            <Spinner class="center gray" />
        </div>
    </transition>
</template>


<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

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
    z-index: 20;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    min-height: 100vh;
    min-height: calc(var(--vh, 1vh) * 100);
    opacity: 1;
    background: $color-white-shade;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &.fade-enter-active,
    &.fade-leave-active {
        transition: opacity 0.35s;
    }
    &.fade-enter, &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
    }
}
</style>
