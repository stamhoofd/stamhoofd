<template>
    <div class="segmented-control">
        <div
            v-for="(item, index) in items"
            :key="index"
            class="item"
            :class="{ selected: item == value }"
            @click="selectItem(index)"
        >
            <div :data-text="labels ? labels[index] : item" />
        </div>
        <div class="pointer"
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
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    props: {
        items: Array,
        value: String,
    },
})
export default class SegmentedControl extends Vue {
    @Prop({ type: Array })
    public items!: any[];
    
    @Prop({ default: null })
    public labels!: string[] | null;

    @Prop()
    public value!: any;

    get selectedIndex() {
        return this.items.indexOf(this.value);
    }

    get pointerTransform() {
        const percentage = (this.selectedIndex / this.items.length) * 100
        return "translateX("+percentage.toFixed(2)+"%)";
    }

    selectItem(index) {
        this.$emit("input", this.items[index]);
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-view > main > h1 + .segmented-control {
    margin-bottom: 25px;
}

.segmented-control {
    background: $color-gray-lighter;
    padding: $border-width;
    border-radius: 6px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    position: relative;
    z-index: 0;
    overflow: hidden;
    @extend .style-button-smaller;
    height: 36px;

    & > .item {
        flex-grow: 1;
        height: 32px;
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
            left: -$border-width/2;
            width: $border-width;
            border-radius: $border-width/2;
            background: $color-gray-light;
            opacity: 1;
            transition: opacity 0.25s;
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
                height: 32px;
                line-height: 32px;
                text-align: center;
                text-overflow: ellipsis;
                opacity: 1;
                overflow: hidden;
                white-space: nowrap;
                transition: opacity 0.25s;
            }

            &::after {
                //background: var(--color-white, white);
                content: attr(data-text);
                position: absolute;
                left: 10px;
                right: 10px;
                top: 0;
                height: 32px;
                line-height: 32px;
                text-align: center;
                text-overflow: ellipsis;
                font-weight: 600;
                overflow: hidden;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.25s;
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
        top: $border-width;
        height: 32px;
        left: $border-width;
        right: $border-width;
        z-index: -1;
        pointer-events: none;

        transition: transform 0.3s ease;
        transform: translate(0, 0);

        & > div {
            position: absolute;
            left: 0;
            top: 0;
            height: 32px;
            background: $color-white-highlight;
            border-radius: 4px;
            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.25);
        }
    }
}
</style>
