<template>
    <div v-if="view" class="st-view loading-view-container">
        <STNavigationBar />
        <main v-if="errorBox">
            <h1>{{ $t('a20a141f-0a94-412e-b731-7b5bde03cd9b') }}</h1>
            <STErrorsDefault :error-box="errorBox" />
        </main>
        <div v-else-if="show" class="loading-view">
            <Spinner class="center gray" />
        </div>
    </div>
    <div v-else-if="errorBox">
        <STErrorsDefault :error-box="errorBox" />
    </div>
    <div v-else-if="show" class="loading-view">
        <Spinner class="center gray" />
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import Spinner from '../Spinner.vue';

withDefaults(
    defineProps<{
        view?: boolean;
        show?: boolean;
        appear?: boolean;
        errorBox?: ErrorBox | null;
    }>(),
    {
        view: false,
        show: true,
        appear: true,
        errorBox: null,
    },
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

.loading-view-container.fade-leave-active {
    opacity: 1;
    transition: opacity 0.2s;
}
.loading-view-container {
    &.fade-leave-to {
        opacity: 0;
    }
}

.loading-view {
    position: absolute !important;
    left: 0;
    right: 0;
    top: 0;
    height: 100%;
    z-index: 12;
    opacity: 1;
    background: var(--color-current-background, #{$color-background});
    //min-height: 100dvh;
    //min-height: calc(var(--vh, 1vh) * 100);
    //transition: opacity 0.2s;
    bottom: 0;

    .st-view > & {
        position: absolute !important;
        min-height: 100vh;
        min-height: 100dvh;
        min-height: calc(var(--vh, 1vh) * 100);
    }

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        height: 100% !important;
        transition: opacity 1s 0.5s; // Slow fading in spinner, with delay, to prevent showing it too fast (don't want to show it if everything loads fast)
        min-height: 48px;
    }

    &.fade-enter-from, .loading-view-container.fade-enter-from & {
        //opacity: 1;

        > .spinner-container {
            opacity: 0;
        }
    }

    &.fade-enter-from.mounted, .loading-view-container.fade-enter-from.mounted & {
        //opacity: 0; // Fade in

        // If already mounted: immediately show spinner
        > .spinner-container {
            opacity: 1;
        }
    }

    &.fade-enter-to.mounted, .loading-view-container.fade-enter-to.mounted & {
        //opacity: 1;
    }

    &.fade-leave-to, .loading-view-container.fade-leave-to & {
        //opacity: 0;
    }

    &.fade-leave-active {
        // Allow user interactino during fade
        //pointer-events: none;
    }
}
</style>
