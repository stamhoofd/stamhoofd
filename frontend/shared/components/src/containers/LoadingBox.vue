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
import { onMounted, ref } from "vue";
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

const mounted = ref(false);

onMounted(() => {
    setTimeout(() => {
        mounted.value = true;
    }, 100);
});

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles';

.loading-view {
    position: absolute !important;
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

    .st-view > & {
        position: absolute !important;
    }

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 100% !important;
        transition: opacity 2s 0.5s; // Slow fading in spinner, with delay, to prevent showing it too fast (don't want to show it if everything loads fast)
    }

    &.fade-enter-from {
        opacity: 1;

        > .spinner-container {
            opacity: 0;
        }
    }

    &.fade-enter-from.mounted {
        opacity: 0; // Fade in

        // If already mounted: immediately show spinner
        > .spinner-container {
            opacity: 1;
        }
    }

    &.fade-enter-to.mounted {
        opacity: 1;
    }

    &.fade-leave-to {
        opacity: 0;
    }

    &.fade-leave-active {
        // Allow user interactino during fade
        //pointer-events: none;
    }
}
</style>
