<template>
    <div class="slider-box">
        <div class="slider">
            <div class="middle">
                <div class="fill"></div>
            </div>
            <div class="handle"></div>
        </div>
        <div class="number">

        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class Slider extends Vue {
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
    @use "~@shared/scss/base/variables.scss";
    $slider-height: 8px;

    .slider {
        margin: 20px 0;
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
            transition: transform 0.2s;

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

            &:active {
                transform: translate(-50%, -50%) scale(0.9, 0.9);
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
        }
    }
</style>
