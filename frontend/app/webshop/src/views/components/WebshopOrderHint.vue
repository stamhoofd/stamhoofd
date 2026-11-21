<template>
    <div class="webshop-order-hint" :class="{ visible: belowScreen }">
        <div class="bar">
            <button class="button secundary" type="button" data-testid="order-hint-button" @click="scrollToTarget">
                <span>{{ text }}</span>
                <span class="icon arrow-down" />
            </button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';

/**
 * Placed below the ordering part of the webshop: while a long description pushes the target (the ordering part, or the
 * button of the form on the page) below the screen, a button floats at the bottom of the screen and scrolls to it
 */
const props = defineProps<{
    text: string;
    target: HTMLElement | null;
    /**
     * Only hidden once the whole target is above the bottom spacing of the hint, e.g. for a button: it then replaces the
     * hint at the same place instead of appearing against the bottom of the screen
     */
    wholeTarget?: boolean;
}>();

const belowScreen = ref(false);
let observer: IntersectionObserver | null = null;

watch([() => props.target, () => props.wholeTarget], ([target, wholeTarget]) => {
    observer?.disconnect();
    observer = null;
    belowScreen.value = false;
    if (!target) {
        return;
    }
    // The bottom margin is the space below the button of the hint. The hint covers the target until then, so it never
    // shows next to the button it points to.
    observer = new IntersectionObserver(([entry]) => {
        const onScreen = wholeTarget ? entry.intersectionRatio >= 0.99 : entry.isIntersecting;
        belowScreen.value = !onScreen && entry.boundingClientRect.top > 0;
    }, { rootMargin: '0px 0px -15px 0px', threshold: wholeTarget ? 0.99 : 0 });
    observer.observe(target);
}, { immediate: true, flush: 'post' });

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
});

function scrollToTarget() {
    // As little as needed: the button of a form ends up at the bottom of the screen, with the form above it
    props.target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

// Below the ordering part, so it floats at the bottom of the screen until the end of the page. It takes no space in the
// page: the bar hangs above the bottom of the screen and nothing moves when it appears or disappears.
// It looks like a toast instead of an order button (smaller, centered, tinted, with a shadow), so it reads as "there is more
// below" and the order button itself stays recognizable when it replaces the hint.
.webshop-order-hint {
    position: sticky;
    bottom: 0;
    z-index: 2;
    height: 0;

    > .bar {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        // The content fades out above the button (like the navigation bar on iOS) instead of stopping at a hard edge
        padding: 30px 0 calc(15px + var(--st-safe-area-bottom, 0px));
        background: linear-gradient(
            rgba(var(--rgb-current-background, 255), var(--rgb-current-background, 255), var(--rgb-current-background, 255), 0) 0%,
            rgba(var(--rgb-current-background, 255), var(--rgb-current-background, 255), var(--rgb-current-background, 255), 1) 30px
        );
        // Only the button: the faded content above it can still be clicked
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;

        > .button {
            pointer-events: auto;
            max-width: 100%;
            border-radius: 999px;
            @extend %style-input-shadow;
            // The colors of a toast
            background: $color-primary-background;
            color: $color-primary;
        }
    }

    &.visible > .bar {
        opacity: 1;
        visibility: visible;
    }
}
</style>
