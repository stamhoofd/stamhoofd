<template>
    <transition name="fade" :appear="appear">
        <div v-if="errorBox">
            <STErrorsDefault :error-box="errorBox" />
        </div>
        <div v-else class="loading-view" v-if="show">
            <Spinner class="center gray" />
        </div>
    </transition>
</template>


<script lang="ts" setup>
import { ErrorBox } from "../errors/ErrorBox";
import Spinner from "../Spinner.vue";

withDefaults(
    defineProps<{
        show?: boolean,
        appear?: boolean,
        errorBox?: ErrorBox|null;
    }>(),
    {
        show: true,
        appear: true,
        errorBox: null
    }
);
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles';

.loading-view {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 12;
    opacity: 1;
    background: var(--color-current-background, #{$color-background});
    min-height: 100vh;
    min-height: 100dvh;
    min-height: calc(var(--vh, 1vh) * 100);
    transition: opacity 0.2s;

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 0;
        top: 0;
        transition: opacity 0.2s 1s;
        right: 0;
        height: 100% !important;

    }

    &.fade-enter-from {
        opacity: 1;

        > .spinner-container {
            opacity: 0;
        }
    }

    &.fade-enter-to {
        opacity: 1;

        > .spinner-container {
            opacity: 1;
        }
    }

    &.fade-leave-to {
        opacity: 0;

        > .spinner-container {
            opacity: 1;
        }
    }
}
</style>
