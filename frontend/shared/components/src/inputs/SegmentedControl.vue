<template>
    <div class="segmented-control">
        <div
            v-for="(item, index) in items"
            :key="index"
            class="item"
            :class="{ selected: item == modelValue }"
            @click="selectItem(index)"
        >
            <div :data-text="labels ? labels[index] : item" />
        </div>
        <div
            class="pointer"
            :style="{
                transform: pointerTransform
            }"
        >
            <div
                :style="{
                    width: 100 / items.length + '%',
                }"
            />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

@Component({
    props: {
        items: Array,
        value: String,
    },
    emits: ['update:modelValue']
})
export default class SegmentedControl extends Vue {
    @Prop({ type: Array })
    public items!: any[];
    
    @Prop({ default: null })
    public labels!: string[] | null;

    @Prop()
    public modelValue!: any;

    get selectedIndex() {
        return this.items.indexOf(this.modelValue);
    }

    get pointerTransform() {
        const percentage = (this.selectedIndex / this.items.length) * 100
        return "translateX("+percentage.toFixed(2)+"%)";
    }

    selectItem(index) {
        this.$emit('update:modelValue', this.items[index]);
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

$segmented-control-border-width: 2px;
$segmented-control-height: 38px;
$segmented-control-inner-height: $segmented-control-height - $segmented-control-border-width * 2;


$border-radius: 9px;

.st-view > main > h1 + .segmented-control{
    margin-bottom: 20px;

    @media (max-width: 550px) {
        margin-bottom: 15px;
    }
}

.segmented-control.with-margin {
    margin-bottom: 15px;
}

.segmented-control {
    user-select: none;
    -webkit-touch-callout: none;
    background: $color-gray-3;
    padding: $segmented-control-border-width;
    border-radius: $border-radius;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    position: relative;
    z-index: 0;
    overflow: hidden;
    @extend .style-button-smaller;
    height: $segmented-control-height;
    contain: strict;

    & > .item {
        flex-grow: 1;
        height: $segmented-control-inner-height;
        padding: 0 10px;

        cursor: pointer;
        user-select: none;
        position: relative;
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);

        &::before {
            content: "";
            position: absolute;
            z-index: -10;
            top: 5px;
            bottom: 5px;
            left: calc(-1 * $segmented-control-border-width / 2);
            width: $segmented-control-border-width;
            border-radius: calc($segmented-control-border-width / 2);
            background: $color-gray-2;
            opacity: 1;
            transition: opacity 0.2s;
        }

        &.selected,
        &:first-child,
        &.selected + div {
            &::before {
                opacity: 0;
            }
        }

        & > div {
            display: block;

            &::before {
                content: attr(data-text);
                position: absolute;
                left: 10px;
                right: 10px;
                top: 0;
                height: $segmented-control-inner-height;;
                line-height: $segmented-control-inner-height;;
                text-align: center;
                text-overflow: ellipsis;
                opacity: 1;
                overflow: hidden;
                white-space: nowrap;
                transition: opacity 0.2s 0.1s;

                // Fixes bug on Safari (desktop) that causes the text to jump up and down during animation
                will-change: opacity;
            }

            &::after {
                content: attr(data-text);
                position: absolute;
                left: 10px;
                right: 10px;
                top: 0;
                height: $segmented-control-inner-height;;
                line-height: $segmented-control-inner-height;;
                text-align: center;
                text-overflow: ellipsis;
                font-weight: 600;
                overflow: hidden;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.2s 0.1s;

                // Fixes bug on Safari (desktop) that causes the text to jump up and down during animation
                will-change: opacity;
            }
        }

        &:active > div {
            &::before {
                opacity: 0.4;
            }
        }

        // Animate font weight change
        &.selected > div {
            &::before {
                opacity: 0;
            }
            &::after {
                opacity: 1;
            }
        }

        // Animate font weight change
        &.selected:active > div {
            &::after {
                opacity: 0.4;
            }
        }
    }
    & > .pointer {
        // Width needs to be correct, because transformX will use percentages!
        position: absolute;
        top: $segmented-control-border-width;
        height: $segmented-control-inner-height;;
        left: $segmented-control-border-width;
        right: $segmented-control-border-width;
        z-index: -1;
        pointer-events: none;

        transition: transform 0.25s ease;
        transform: translate(0, 0);
        will-change: transform;

        & > div {
            position: absolute;
            left: 0;
            top: 0;
            height: $segmented-control-inner-height;
            background: $color-background-highlight;
            border-radius: $border-radius - $segmented-control-border-width;
            box-shadow: 0px 2px 6px rgba(0, 0, 0, 0.25);
        }
    }
}
</style>
