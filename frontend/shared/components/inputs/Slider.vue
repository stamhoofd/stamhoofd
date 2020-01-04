<template>
    <div class="slider-box">
        <div class="slider-container" @mousedown="dragStart" @touchstart="dragStart">
            <div class="slider" ref="slider">
                <div class="middle">
                    <div class="fill" :style="{width: this.handlePercentage+'%'}" :class="{animate: animate}"></div>
                </div>
                <div class="handle" ref="handle" :style="{left: this.handlePercentage+'%'}" :class="{animate: animate}"></div>
            </div>
        </div>
       
        <div class="number">
            <input type="number" pattern="[0-9]*" v-model.number="value" v-on:change="updateSlider">
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class Slider extends Vue {
    min: integer = 0;
    max: integer = 300;

    /// Offset from the center of the handle during drag.
    startOffset: float = 0;
    handlePercentage: float = 50;
    round: int? = 10;

    // if softBounds = true, maximum and minimum is overrideable by the user 
    // when he manually enters a number. This is usefull if the maximum and 
    // minimum is just a convenience.
    softBounds: boolean = true;
    animate: boolean = false;

    value: integer = 150;
    dragging: boolean = false;

    mounted() {
        document.addEventListener('mousemove', this.mouseMove);
        document.addEventListener('touchmove', this.mouseMove);

        document.addEventListener('mouseup', this.mouseUp);
        document.addEventListener('touchend', this.mouseUp);
    }

    getEventX(event) {
        var x = 0;
        if (event.changedTouches) {
            var touches = event.changedTouches;
            for (var i = 0; i < touches.length; i++) {
                x = touches[i].pageX;
            }
        } else {
            x = event.pageX;
        }
        return x;
    }

    getXOffset() {
        return this.$refs.slider.getBoundingClientRect().left;
    }

    getWidth() {
        return this.$refs.slider.offsetWidth;
    }

    getHandleWidth() {
        // We add a little overlap over here
        return this.$refs.handle.offsetWidth - 2;
    }

    getHandleX() {
        let handleWidth = this.getHandleWidth();
        return (this.value - this.min) / (this.max - this.min) * (this.getWidth() - handleWidth) + handleWidth/2;
    }

    getHandleOffset(event) {
        return this.getEventX(event) - this.getXOffset() - this.getHandleX();
    }

    dragStart(event) {
        this.startOffset = this.getHandleOffset(event);
        console.log("Start with offset "+this.startOffset);
        this.dragging = true;
        
        
        if (Math.abs(this.startOffset) > this.getHandleWidth()/2) {
            this.startOffset = 0;
            // immediately update!

            this.animate = true;
            this.mouseMove(event);
        } else {
            this.animate = false;
        }
        

    }

    // Set the percentage and value based on a manual entered value
    updateSlider(event) {
        this.value = Math.round(this.value);
        if (this.value > this.max) {
            if (this.softBounds) {
                this.max = this.value;
            } else {
                this.value = this.max;
            }
        }

        if (this.value < this.min) {
            if (this.softBounds) {
                this.value = Math.max(0, this.value);
                this.min = this.value;
            } else {
                this.value = this.min;
            }
        }
        var handleWidth = this.getHandleWidth();
        var width = this.getWidth();
        var percentage = (this.value - this.min) / (this.max - this.min);
        var relativeWidth = width - handleWidth;
        var percentageOffset = handleWidth / 2 / width;

        // Convert the percentage to the handle percentage
        this.animate = true;
        this.handlePercentage = (percentage / width * relativeWidth + percentageOffset) * 100;
    }

    mouseMove(event) {
        if (!this.dragging) {
            return;
        }

        var handleWidth = this.getHandleWidth();
        var width = this.getWidth();
        var x = this.getEventX(event) - this.getXOffset() - this.startOffset - handleWidth/2;

        var relativeWidth = width - handleWidth;
        var percentageOffset = handleWidth / 2 / width;

        var percentage = Math.min(Math.max(0, x / relativeWidth), 1);

        // Convert the percentage to the handle percentage
        this.handlePercentage = (percentage / width * relativeWidth + percentageOffset) * 100;

        let oldValue = this.value;
        this.value = Math.round((percentage) * (this.max - this.min)) + this.min;
        if (this.round) {
            this.value = Math.round(this.value/this.round)*this.round;
        }
        
        if (oldValue == this.value) {
            this.animate = false;
        }
        console.log("value: "+this.value);
    }

    mouseUp(event) {
        this.dragging = false;
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
    @use "~@shared/scss/base/variables.scss";
    @use "~@shared/scss/components/inputs.scss";

    $slider-height: 6px;

    .slider-box {
        display: flex;
        flex-direction: row;
        align-items: center;
        @extend .input-spacing;
        margin-bottom: 20px;
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

        &> input {

            text-align: right;
            width: 50px;
            display: block;
            border-bottom: 2px dashed $color-gray-lighter;
            padding: 5px 0;

            // Firefox fix
            -moz-appearance:textfield;

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

        .middle {
            top: 0;
            left: $border-width/2;
            right: $slider-height/2;
            bottom: 0;
            position: absolute;
            background: $color-gray-lighter;
            clip-path: polygon(0 $slider-height/2 - $border-width/2,100% 0,100% 100%,0 $slider-height/2 + $border-width/2);
    
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
            background: linear-gradient(#EEEEEE, #C7C7C7);
            box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.1);
            border-radius: (25px)/2;
            cursor: pointer;
            z-index: 3;

            &::before {
                left: 1px;
                top: 1px;
                bottom: 1px;
                right: 1px;
                background: white;
                border-radius: (25px - 2px)/2;
                position: absolute;
                content: '';
            }

            &.animate {
                // It is more performant to transition on translation instead of left, need to change this in the future.
                transition: left 0.2s;
            }
        }
        

        &::before {
            content: '';
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
            content: '';
            background: $color-gray-lighter;
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
