<template>
    <div class="slider-box">
        <div class="slider-container" @mousedown="dragStart" @touchstart="dragStart">
            <div ref="slider" class="slider">
                <div class="middle">
                    <div class="fill" :style="{ width: handlePercentage + '%' }" :class="{ animate: animate }" />
                </div>
                <div
                    ref="handle"
                    class="handle"
                    :style="{ left: handlePercentage + '%' }"
                    :class="{ animate: animate }"
                />
            </div>
        </div>

        <div class="number">
            <input
                v-model.number="internalValue"
                type="number"
                pattern="[0-9]*"
                @change="updateSlider"
                @focus="delayedSelect"
            >
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef } from 'vue';

const model = defineModel<number>({ default: 0 });

const props = withDefaults(defineProps<{
    min?: number;
    max?: number;
}>(), {
    min: 0,
    max: 500,
});

// if softBounds = true, maximum and minimum is overrideable by the user
// when he manually enters a number. This is usefull if the maximum and
// minimum is just a convenience.
const softBounds = true;
const round: number | undefined = 10;

const min = ref(props.min);
const max = ref(props.max);

/// Offset from the center of the handle during drag.
let startOffset = 0;
const handlePercentage = ref(50);
const animate = ref(false);
let dragging = false;

const slider = useTemplateRef<HTMLElement>('slider');
const handle = useTemplateRef<HTMLElement>('handle');

const internalValue = model;

onMounted(() => {
    updateSlider();
});

function attach() {
    document.addEventListener("mousemove", mouseMove, {
        passive: false,
    });
    document.addEventListener("touchmove", mouseMove, {
        passive: false,
    });

    document.addEventListener("mouseup", mouseUp, { passive: false });
    document.addEventListener("touchend", mouseUp, { passive: false });
}

function detach() {
    document.removeEventListener("mousemove", mouseMove);
    document.removeEventListener("touchmove", mouseMove);

    document.removeEventListener("mouseup", mouseUp);
    document.removeEventListener("touchend", mouseUp);
}

function delayedSelect(event: Event) {
    // Prevent default seems to be required because else it wont work 100% of the time
    event.preventDefault();

    if (event.target instanceof HTMLInputElement) {
        // Select all the text
        event.target.select();
    }

    const handler = (event: Event) => {
        // Safari deselects the text on mouse up, we need to prevent this
        event.preventDefault();
        document.removeEventListener("mouseup", handler);
        return false;
    };

    // Safari fix
    document.addEventListener("mouseup", handler);
}

function getEventX(event: any) {
    let x = 0;
    if (event.changedTouches) {
        const touches = event.changedTouches;
        for (const touch of touches) {
            x = touch.pageX;
        }
    }
    else {
        x = event.pageX;
    }
    return x;
}

function getXOffset() {
    return slider.value!.getBoundingClientRect().left;
}

function getWidth() {
    return slider.value!.offsetWidth;
}

function getHandleWidth() {
    // We add a little overlap over here
    return handle.value!.offsetWidth - 2;
}

function getHandleX() {
    const handleWidth = getHandleWidth();
    return ((internalValue.value - min.value) / (max.value - min.value)) * (getWidth() - handleWidth) + handleWidth / 2;
}

function getHandleOffset(event: Event) {
    return getEventX(event) - getXOffset() - getHandleX();
}

function dragStart(event: Event) {
    if (dragging) {
        return;
    }
    // startOffset = the distance between the center of the handle during dragging
    startOffset = getHandleOffset(event);
    dragging = true;

    if (Math.abs(startOffset) > getHandleWidth() / 2) {
        startOffset = 0;
        // immediately update!

        animate.value = true;
        mouseMove(event);
    }
    // Prevent scrolling (on mobile) and other stuff
    event.preventDefault();

    attach();
    return false;
}

// Set the percentage and value based on a manual entered value
function updateSlider() {
    let _value = Math.round(model.value);
    if (_value > max.value) {
        if (softBounds) {
            max.value = _value;
        }
        else {
            _value = max.value;
        }
    }

    if (_value < min.value) {
        if (softBounds) {
            model.value = Math.max(0, _value);
            min.value = _value;
        }
        else {
            _value = min.value;
        }
    }

    if (_value !== model.value) {
        internalValue.value = _value;
    }

    const handleWidth = getHandleWidth();
    const width = getWidth();
    const percentage = (model.value - min.value) / (max.value - min.value);
    const relativeWidth = width - handleWidth;
    const percentageOffset = handleWidth / 2 / width;

    // Convert the percentage to the handle percentage
    animate.value = true;
    handlePercentage.value = ((percentage / width) * relativeWidth + percentageOffset) * 100;
}

function mouseMove(event: Event) {
    const handleWidth = getHandleWidth();
    const width = getWidth();
    const x = getEventX(event) - getXOffset() - startOffset - handleWidth / 2;

    const relativeWidth = width - handleWidth;
    const percentageOffset = handleWidth / 2 / width;

    const percentage = Math.min(Math.max(0, x / relativeWidth), 1);

    // Convert the percentage to the handle percentage
    handlePercentage.value = ((percentage / width) * relativeWidth + percentageOffset) * 100;

    const oldValue = model.value;
    const newValue = Math.round(percentage * (max.value - min.value)) + min.value;
    if (round) {
        internalValue.value = Math.round(newValue / round) * round;
    }
    else {
        internalValue.value = newValue;
    }

    if (oldValue === newValue) {
        animate.value = false;
    }

    // Prevent scrolling (on mobile) and other stuff
    event.preventDefault();
    return false;
}

function mouseUp() {
    if (dragging) {
        detach();
        dragging = false;
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

$slider-height: 6px;

.slider-box {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 44px;
}

.slider-container {
    flex-grow: 1;
    cursor: pointer;
    user-select: none;
}

.number {
    flex-shrink: 0;
    padding-left: 15px;
    text-align: right;

    & > input {
        text-align: right;
        width: 50px;
        display: block;
        border-bottom: 2px dashed $color-border;
        padding: 5px 0;

        // Firefox fix
        -moz-appearance: textfield;

        &:focus {
            border-color: $color-primary;
        }
    }
}

.slider {
    margin: 15px 0;
    position: relative;
    height: $slider-height;
    display: block;
    z-index: 0; // prevent going before sticky elements

    .middle {
        top: 0;
        left: calc($border-width / 2);
        right: calc($slider-height / 2);
        bottom: 0;
        position: absolute;
        background: $color-gray-2;
        clip-path: polygon(
            0 calc($slider-height / 2 - $border-width / 2),
            100% 0,
            100% 100%,
            0 calc($slider-height / 2 + $border-width / 2)
        );

        .fill {
            left: calc(-1 * $border-width / 2);
            // TODO: also right + width should get corrected
            top: 0;
            bottom: 0;
            background: $color-primary;
            position: absolute;
            width: 50%;

            &.animate {
                transition: width 0.2s;
            }
        }
    }

    .handle {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        height: 25px;
        width: 25px;
        background: $color-gray-3;
        box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.1);
        border-radius: calc(25px / 2);
        cursor: pointer;
        z-index: 3;

        &::before {
            left: 1px;
            top: 1px;
            bottom: 1px;
            right: 1px;
            background: $color-background-interactive;
            border-radius: calc( (25px - 2px) / 2);
            position: absolute;
            content: "";
        }

        &.animate {
            // It is more performant to transition on translation instead of left, need to change this in the future.
            transition: left 0.2s;
        }
    }

    &::before {
        content: "";
        background: $color-primary;
        left: 0;
        top: calc($slider-height / 2 - $border-width / 2);
        height: $border-width;
        width: $border-width;
        position: absolute;
        border-radius: calc($border-width / 2);
        z-index: 2;
    }

    &::after {
        content: "";
        background: $color-gray-2;
        right: 0;
        top: 0;

        height: $slider-height;
        width: $slider-height;
        position: absolute;
        border-radius: calc($slider-height / 2);
        z-index: 2;
    }
}
</style>
