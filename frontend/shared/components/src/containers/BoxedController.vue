<template>
    <div class="st-view">
        <div class=" boxed-controller">
            <div ref="mainElement" class="boxed-main">
                <FramedComponent v-if="root" :key="root.key" :root="root" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { FramedComponent } from '@simonbackx/vue-app-navigation';

const props = defineProps<{
    root: ComponentWithProperties;
}>();

const returnToHistoryIndex = () => {
    return props.root.returnToHistoryIndex();
};

defineExpose({
    returnToHistoryIndex,
});

</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

@media (min-width: 800px) {
    .boxed-controller {
        --tab-bar-header-height: 80px;
        height: calc(var(--vh, 1vh) * 100);
        max-height: 100vh;
        max-height: 100dvh;
        overflow: hidden;
        overflow: clip; // More modern + disables scrolling
        --saved-vh: var(--vh, 1vh);
        //background: $color-background-shade !important;
        padding: 20px 0;
        box-sizing: border-box;

        > .boxed-main {
            background: $color-background;
            //width: min(100vw, var(--st-sheet-width, 500px));
            margin: 0 auto;
            border-radius: $border-radius-modals;
            overflow: hidden;
            --vh: calc((var(--saved-vh, 1vh) * 100 - 40px) / 100);
            //border: 1px solid $color-border-lighter;
            --st-horizontal-padding: var(--sheet-horizontal-padding, 30px);
            --st-vertical-padding: var(--sheet-vertical-padding, 30px);

            .st-view {
                contain: content;
                // We set explicit widths on all views inside a sheet, so we can animate width changes
                width: min(100vw, var(--st-sheet-width, 500px));
            margin: 0 auto;

                // Automatic height
                height: auto;
                min-height: min(500px, calc(var(--vh, 1vh) * 100));
                max-height: calc(var(--vh, 1vh) * 100);
                contain: content;
            }
        }
    }
}

</style>
