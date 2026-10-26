<template>
    <nav class="checkout-progress" :class="{ 'has-logo': !!logo, faded: hideSteps }" data-testid="checkout-progress">
        <ImageComponent v-if="logo" class="logo" :image="logo.logo" :image-dark="logo.logoDark" data-testid="checkout-progress-logo" />
        <div ref="container" class="steps">
            <!-- Always rendered, so we can measure whether all titles fit -->
            <div ref="titles" class="titles" :class="{ hidden: compact }" :aria-hidden="compact ? 'true' : undefined">
                <component
                    :is="isClickable(index) ? 'button' : 'span'"
                    v-for="(title, index) in titles"
                    :key="index"
                    :type="isClickable(index) ? 'button' : undefined"
                    class="button text"
                    :class="{ done: index < current, current: index === current }"
                    :aria-current="index === current ? 'step' : undefined"
                    :tabindex="isClickable(index) && compact ? -1 : undefined"
                    @click="isClickable(index) ? emit('select', index) : undefined"
                >
                    <span v-if="index < current" class="icon success" />
                    <span v-else class="step-number" aria-hidden="true">
                        <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9.25" /></svg>
                        <span>{{ index + 1 }}</span>
                    </span>
                    <span class="title">{{ title }}</span>
                </component>
            </div>
            <p v-if="compact" data-testid="checkout-progress-compact">
                {{ $t('%1WP', { current: (current + 1).toString(), total: titles.length.toString() }) }}
            </p>
        </div>

        <div class="bar" role="progressbar" :aria-valuenow="percentage" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: percentage + '%' }" />
        </div>
    </nav>
</template>

<script lang="ts" setup>
import { useElementSize } from '@stamhoofd/components/hooks/useElementSize.ts';
import ImageComponent from '@stamhoofd/components/views/ImageComponent.vue';
import type { Image } from '@stamhoofd/structures';
import { computed, useTemplateRef } from 'vue';

const props = defineProps<{
    titles: string[];
    /** Index of the current step in titles */
    current: number;
    /** Whether the next step can be clicked */
    canContinue: boolean;
    logo?: { logo: Image; logoDark: Image | null } | null;
    /** Fades out the steps and the progress bar, the logo stays visible */
    hideSteps?: boolean;
}>();

const emit = defineEmits<{
    /** A previous step or the next step was clicked */
    select: [index: number];
}>();

function isClickable(index: number) {
    return index < props.current || (props.canContinue && index === props.current + 1);
}

const percentage = computed(() => Math.round((props.current + 1) / props.titles.length * 100));

const { width: containerWidth } = useElementSize(useTemplateRef('container'));
const { width: titlesWidth } = useElementSize(useTemplateRef('titles'));
const compact = computed(() => titlesWidth.value > containerWidth.value);
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles';

.checkout-progress {
    position: relative;
    box-sizing: border-box;
    padding: 0 max(var(--st-horizontal-padding, 40px), var(--st-safe-area-right, 0px)) 0 max(var(--st-horizontal-padding, 40px), var(--st-safe-area-left, 0px));
    display: flex;
    // The progress bar is pinned to the top, the steps sit at the bottom
    align-items: flex-end;
    gap: 15px;

    > .logo {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        margin-bottom: 3px;
    }

    // Keeps the steps centered on the page
    &.has-logo::after {
        content: '';
        flex-shrink: 0;
        width: 28px;
    }

    > .steps {
        position: relative;
        flex-grow: 1;
        min-width: 0;
        display: flex;
        justify-content: center;
        // Only horizontally: descenders and the touch area of the buttons stay visible
        overflow-x: clip;
    }

    > .steps, > .bar {
        transition: opacity var(--navigation-transition-duration, 300ms), visibility var(--navigation-transition-duration, 300ms);
    }

    // Hidden after fading out, so the steps can't be clicked or focused
    &.faded > .steps, &.faded > .bar {
        opacity: 0;
        visibility: hidden;
    }

    > .steps > .titles {
        display: flex;
        align-items: center;
        gap: 32px;
        width: max-content;

        &.hidden {
            position: absolute;
            visibility: hidden;
        }

        > .button.text {
            color: $color-gray-text;

            &.done {
                color: $color-dark;
            }

            &.current {
                color: $color-primary;
            }

            // An svg circle stays smooth at every zoom level, unlike a rounded border
            > .step-number {
                flex-shrink: 0;
                display: grid;
                place-items: center;
                width: 20px;
                height: 20px;
                margin-right: 7px;
                font-size: 11px;
                font-weight: $font-weight-semibold;
                line-height: 1;
                font-variant-numeric: tabular-nums;

                > * {
                    grid-area: 1 / 1;
                }

                > svg {
                    width: 100%;
                    height: 100%;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.5;
                }
            }
        }
    }

    > .steps > p {
        @extend %style-button-small;
        color: $color-dark;
        // Same as the buttons, so it sits at the same height
        line-height: 34px;
    }

    > .bar {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 2px;
        background: $color-border;

        > span {
            display: block;
            height: 100%;
            background: $color-primary;
            border-radius: 0 3px 3px 0;
            transition: width 300ms;
        }
    }
}
</style>
