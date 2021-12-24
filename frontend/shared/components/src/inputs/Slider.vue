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

<script lang="ts">
import { Component, Prop,Vue } from "vue-property-decorator";

@Component
export default class Slider extends Vue {
    @Prop({ type: Number, default: 0 })
    min!: number

    @Prop({ type: Number, default: 500 })
    max!: number

    /// Offset from the center of the handle during drag.
    startOffset = 0;
    handlePercentage = 50;
    round?: number = 10;

    // if softBounds = true, maximum and minimum is overrideable by the user
    // when he manually enters a number. This is usefull if the maximum and
    // minimum is just a convenience.
    softBounds = true;
    animate = false;

    @Prop({ type: Number, default: 0 })
    value!: number;

    dragging = false;

    get internalValue() {
        return this.value
    }

    set internalValue(val: number) {
        this.$emit("input", val)
    }

    mounted() {
        this.updateSlider()
    }

    attach() {
        document.addEventListener("mousemove", this.mouseMove, {
            passive: false,
        });
        document.addEventListener("touchmove", this.mouseMove, {
            passive: false,
        });

        document.addEventListener("mouseup", this.mouseUp, { passive: false });
        document.addEventListener("touchend", this.mouseUp, { passive: false });
    }

    detach() {
        document.removeEventListener("mousemove", this.mouseMove);
        document.removeEventListener("touchmove", this.mouseMove);

        document.removeEventListener("mouseup", this.mouseUp);
        document.removeEventListener("touchend", this.mouseUp);
    }

    delayedSelect(event) {
        // Prevent default seems to be required because else it wont work 100% of the time
        event.preventDefault();

        // Select all the text
        event.target.select();

        const handler = (event) => {
            // Safari deselects the text on mouse up, we need to prevent this
            event.preventDefault();
            document.removeEventListener("mouseup", handler);
            return false;
        };

        // Safari fix
        document.addEventListener("mouseup", handler);
    }

    getEventX(event: any) {
        let x = 0;
        if (event.changedTouches) {
            const touches = event.changedTouches;
            for (const touch of touches) {
                x = touch.pageX;
            }
        } else {
            x = event.pageX;
        }
        return x;
    }

    getXOffset() {
        return (this.$refs.slider as HTMLElement).getBoundingClientRect().left;
    }

    getWidth() {
        return (this.$refs.slider as HTMLElement).offsetWidth;
    }

    getHandleWidth() {
        // We add a little overlap over here
        return (this.$refs.handle as HTMLElement).offsetWidth - 2;
    }

    getHandleX() {
        const handleWidth = this.getHandleWidth();
        return ((this.internalValue - this.min) / (this.max - this.min)) * (this.getWidth() - handleWidth) + handleWidth / 2;
    }

    getHandleOffset(event) {
        return this.getEventX(event) - this.getXOffset() - this.getHandleX();
    }

    dragStart(event) {
        if (this.dragging) {
            return;
        }
        // startOffset = the distance between the center of the handle during dragging
        this.startOffset = this.getHandleOffset(event);
        this.dragging = true;

        if (Math.abs(this.startOffset) > this.getHandleWidth() / 2) {
            this.startOffset = 0;
            // immediately update!

            this.animate = true;
            this.mouseMove(event);
        }
        // Prevent scrolling (on mobile) and other stuff
        event.preventDefault();

        this.attach();
        return false;
    }

    // Set the percentage and value based on a manual entered value
    updateSlider() {
        let _value = Math.round(this.value);
        if (_value > this.max) {
            if (this.softBounds) {
                this.max = _value;
            } else {
                _value = this.max;
            }
        }

        if (_value < this.min) {
            if (this.softBounds) {
                this.value = Math.max(0, _value);
                this.min = _value;
            } else {
                _value = this.min;
            }
        }

        if (_value != this.value) {
            this.internalValue = _value
        }

        const handleWidth = this.getHandleWidth();
        const width = this.getWidth();
        const percentage = (this.value - this.min) / (this.max - this.min);
        const relativeWidth = width - handleWidth;
        const percentageOffset = handleWidth / 2 / width;

        // Convert the percentage to the handle percentage
        this.animate = true;
        this.handlePercentage = ((percentage / width) * relativeWidth + percentageOffset) * 100;
    }

    mouseMove(event) {
        const handleWidth = this.getHandleWidth();
        const width = this.getWidth();
        const x = this.getEventX(event) - this.getXOffset() - this.startOffset - handleWidth / 2;

        const relativeWidth = width - handleWidth;
        const percentageOffset = handleWidth / 2 / width;

        const percentage = Math.min(Math.max(0, x / relativeWidth), 1);

        // Convert the percentage to the handle percentage
        this.handlePercentage = ((percentage / width) * relativeWidth + percentageOffset) * 100;

        const oldValue = this.value;
        const newValue = Math.round(percentage * (this.max - this.min)) + this.min;
        if (this.round) {
            this.internalValue = Math.round(newValue / this.round) * this.round;
        } else {
            this.internalValue = newValue
        }

        if (oldValue == newValue) {
            this.animate = false;
        }

        // Prevent scrolling (on mobile) and other stuff
        event.preventDefault();
        return false;
    }

    mouseUp(_event) {
        if (this.dragging) {
            this.detach();
            this.dragging = false;
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

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
        left: $border-width/2;
        right: $slider-height/2;
        bottom: 0;
        position: absolute;
        background: $color-gray-2;
        clip-path: polygon(
            0 $slider-height/2 - $border-width/2,
            100% 0,
            100% 100%,
            0 $slider-height/2 + $border-width/2
        );

        .fill {
            left: -$border-width/2;
            // todo: also right + width should get corrected
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
        border-radius: (25px)/2;
        cursor: pointer;
        z-index: 3;

        &::before {
            left: 1px;
            top: 1px;
            bottom: 1px;
            right: 1px;
            background: $color-background-interactive;
            border-radius: (25px - 2px)/2;
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
        top: $slider-height/2 - $border-width/2;
        height: $border-width;
        width: $border-width;
        position: absolute;
        border-radius: $border-width/2;
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
        border-radius: $slider-height/2;
        z-index: 2;
    }
}
</style>