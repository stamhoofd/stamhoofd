<template>
    <div
        ref="tooltipEl"
        class="tooltip"
        :class="usedXPlacement+' '+usedYPlacement+' '+icon"
        :style="{ transformOrigin, top: top !== null ? top + 'px' : undefined, left: left !== null ? (left + 'px') : undefined, right: right !== null ? (right + 'px') : undefined, bottom: bottom !== null ? (bottom + 'px') : undefined, width: usedPreferredWidth !== null ? (usedPreferredWidth + 'px') : undefined, height: usedPreferredHeight !== null ? (usedPreferredHeight + 'px') : undefined }"
    >
        <span v-if="icon" :class="'icon '+icon" />
        <span>{{ text }}</span>
    </div>
</template>

<script setup lang="ts">
import { usePop } from '@simonbackx/vue-app-navigation';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

const props = withDefaults(defineProps<{
    text?: string;
    icon?: string | null;
    x?: number;
    y?: number;
    xPlacement?: 'right' | 'left';
    yPlacement?: 'bottom' | 'top';
    /** In case a placement is not possible, instead of just swapping xPlacement, also affect the x position first with the wrapWidth (needed for e.g. context menu's) */
    wrapWidth?: number | null;
    /** In case a placement is not possible, instead of just swapping yPlacement, also affect the y position first with the wrapHeight (needed for e.g. context menu's) */
    wrapHeight?: number | null;
}>(), {
    text: 'No tooltip text set',
    icon: null,
    x: 0,
    y: 0,
    xPlacement: 'right',
    yPlacement: 'bottom',
    wrapWidth: null,
    wrapHeight: null,
});

const pop = usePop();

const tooltipEl = ref<HTMLElement | null>(null);
const top = ref<number | null>(null);
const left = ref<number | null>(null);
const right = ref<number | null>(null);
const bottom = ref<number | null>(null);
const transformOrigin = ref('0 0');
const usedXPlacement = ref<'right' | 'left'>(props.xPlacement);
const usedYPlacement = ref<'bottom' | 'top'>(props.yPlacement);
const usedPreferredHeight = ref<number | null>(null);
const usedPreferredWidth = ref<number | null>(null);

function hide() {
    pop({ force: true })?.catch(console.error);
}

onMounted(() => {
    const el = tooltipEl.value!;
    let width = el.offsetWidth;
    let height = el.offsetHeight;

    const viewPadding = 15;

    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName('body')[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
        clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

    if (width > clientWidth - viewPadding * 2) {
        usedPreferredWidth.value = clientWidth - viewPadding * 2;
        width = clientWidth - viewPadding * 2;
    }

    if (height > clientHeight - viewPadding * 2) {
        usedPreferredHeight.value = clientHeight - viewPadding * 2;
        height = clientHeight - viewPadding * 2;
    }

    let usedX = props.x;

    if (props.xPlacement === 'right') {
        left.value = props.x;

        if (width > clientWidth - viewPadding - props.x) {
            left.value = null;
            usedXPlacement.value = 'left';

            if (props.wrapWidth !== null) {
                usedX = usedX - props.wrapWidth;
                right.value = Math.min(clientWidth - usedX, clientWidth - viewPadding - width);

                if (right.value < viewPadding) {
                    right.value = viewPadding;
                }
            } else {
                right.value = viewPadding;
            }
        } else {
            if (left.value < viewPadding) {
                left.value = viewPadding;
            }
        }
    } else {
        right.value = Math.min(clientWidth - usedX, clientWidth - viewPadding - width);

        if (right.value < viewPadding) {
            right.value = viewPadding;
        }
    }

    let usedY = props.y;

    if (props.yPlacement === 'bottom') {
        top.value = props.y;

        if (height > clientHeight - viewPadding - props.y) {
            top.value = null;
            usedYPlacement.value = 'top';

            if (props.wrapHeight !== null) {
                usedY = usedY - props.wrapHeight;
                bottom.value = Math.min(clientHeight - usedY, clientHeight - viewPadding - height);

                if (bottom.value < viewPadding) {
                    bottom.value = viewPadding;
                }
            } else {
                bottom.value = viewPadding;
            }
        } else {
            if (top.value < viewPadding) {
                top.value = viewPadding;
            }
        }
    } else {
        bottom.value = Math.min(clientHeight - usedY, clientHeight - viewPadding - height);

        if (bottom.value < viewPadding) {
            bottom.value = viewPadding;
        }
    }

    const objLeft = left.value !== null ? left.value : (clientWidth - right.value! - width);
    const xTransform = ((usedX - objLeft) / width * 100).toFixed(2);

    const objTop = top.value !== null ? top.value : (clientHeight - bottom.value! - height);
    const yTransform = ((usedY - objTop) / height * 100).toFixed(2);

    transformOrigin.value = xTransform + '% ' + yTransform + '%';

    document.addEventListener('touchstart', hide, { passive: true });
    document.addEventListener('pointerdown', hide, { passive: true });
    document.addEventListener('wheel', hide, { passive: true });
});

onBeforeUnmount(() => {
    document.removeEventListener('touchstart', hide);
    document.removeEventListener('pointerdown', hide);
    document.removeEventListener('wheel', hide);
});

defineExpose({
    hide,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.tooltip {
    position: fixed;
    z-index: 10000;
    @extend .style-context-menu-item;
    line-height: 1.5;
    @extend .style-overlay-shadow;
    box-sizing: border-box;
    max-width: 350px;

    background: $color-background-shade-darker;

    --color-current-background: #{$color-background-shade-darker};
    --color-current-background-shade: #{$color-background-shade-darker-darker};
    --color-current-background-shade-darker: #{$color-border};

    border: $border-width-thin solid $color-border-shade;
    padding: 10px 15px;
    border-radius: $border-radius-modals;
    color: $color-dark;

    pointer-events: none;

    transform-origin: 0% 0%;
    transition: transform 0.2s;

    &.top {
        transform-origin: 0% 100%;
    }

    &.left {
        transform-origin: 100% 0%;

        &.top {
            transform-origin: 100% 100%;
        }
    }

    &.show-enter-active,
    &.show-leave-active {
        transition: opacity 0.2s, transform 0.2s;
    }
    &.show-enter-from, &.show-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
        transform: scale(0.8, 0.8);
    }

    > .icon {
        display: inline-block;
        margin: -10px 5px -10px 0;
        vertical-align: middle;
    }

    > span {
        display: inline-block;
        vertical-align: middle;
    }

    &.green {
        background-color: $color-success-background;
        color: $color-success-dark;

        .progress {
            background: $color-success;
        }
    }
}
</style>
