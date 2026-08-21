<template>
    <div class="progress-outline">
        <slot />
        <Transition name="progress-outline-fade">
            <svg v-if="progress < 100" class="progress-outline-svg" aria-hidden="true" :style="{'--outline-width': width + 'px', '--outline-offset': offset + 'px', '--outline-radius': radius + 'px'}">
                <rect class="track" />
                <rect class="bar" pathLength="100" :stroke-dashoffset="100 - Math.min(100, Math.max(0, progress))" />
            </svg>
        </Transition>
    </div>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
    /** 0 - 100 */
    progress: number;
    /** Corner radius of the outline in px */
    radius?: number;
    /** Stroke width in px */
    width?: number;
    /** Gap between the content and the outline in px */
    offset?: number;
}>(), {
    radius: 2,
    width: 2,
    offset: 2,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.progress-outline {
    position: relative;
    display: block;
    color: inherit;

    > .progress-outline-svg {
        position: absolute;
        pointer-events: none;
        overflow: visible;
        inset: calc(-1 * (var(--outline-offset) + var(--outline-width)));
        width: calc(100% + 2 * (var(--outline-offset) + var(--outline-width)));
        height: calc(100% + 2 * (var(--outline-offset) + var(--outline-width)));

        > rect {
            x: calc(var(--outline-width) / 2);
            y: calc(var(--outline-width) / 2);
            width: calc(100% - var(--outline-width));
            height: calc(100% - var(--outline-width));
            rx: var(--outline-radius);
            fill: none;
            stroke: currentColor;
            stroke-width: var(--outline-width);
        }

        > rect.track {
            stroke: $color-border-shade;
        }

        > rect.bar {
            stroke-linecap: round;
            stroke-dasharray: 100;
        }

        &.progress-outline-fade-leave-active {
            transition: opacity 0.2s;
        }

        &.progress-outline-fade-leave-to {
            opacity: 0;
        }
    }
}
</style>
