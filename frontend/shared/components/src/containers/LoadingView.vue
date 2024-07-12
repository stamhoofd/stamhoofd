<template>
    <transition name="fade" appear>
        <div class="st-view">
            <STNavigationBar v-if="errorBox" title="Fout" />

            <div v-if="!errorBox" class="loading-view">
                <Spinner class="center gray" />
            </div>
            <main v-else>
                <h1>Er ging iets fout</h1>
                <STErrorsDefault :error-box="errorBox" />
            </main>
        </div>
    </transition>
</template>


<script lang="ts" setup>
import Spinner from "../Spinner.vue";
import { ErrorBox } from "../errors/ErrorBox";

withDefaults(
    defineProps<{
        errorBox?: ErrorBox|null;
    }>(),
    {
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
    z-index: 12;
    opacity: 1;
    background: var(--color-current-background, #{$color-background});

    > .spinner-container {
        opacity: 1;
        position: absolute;
        left: 0;
        top: 0;
        transition: opacity 0.2s 1s;
        bottom: 0;
        right: 0;
        height: 100%;

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

    &.fade-enter-from /* .fade-leave-active below version 2.1.8 */ {
        > .spinner-container {
            opacity: 0;
        }
    }

    &.fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
    }
}
</style>
