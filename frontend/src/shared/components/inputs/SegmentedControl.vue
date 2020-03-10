<template>
    <div class="segmented-control">
        <div
            v-for="(item, index) in items"
            :key="index"
            :class="{ selected: item == value }"
            @click="selectItem(index)"
        >
            <span :data-text="labels ? labels[index] : item"></span>
        </div>
        <span
            ><span
                :style="{
                    left: (selectedIndex / items.length) * 100 + '%',
                    width: 100 / items.length + '%'
                }"
            ></span
        ></span>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    props: {
        items: Array,
        value: String
    }
})
export default class SegmentedControl extends Vue {
    public selectedIndex: number = 0;
    @Prop({ type: Array })
    public items!: any[];
    @Prop({ default: null })
    public labels!: string[] | null;

    @Prop()
    public value!: any;

    mounted() {
        this.selectedIndex = this.items.indexOf(this.value);
    }

    selectItem(index) {
        this.selectedIndex = index;
        this.$emit("input", this.items[index]);
    }
}
</script>

<style lang="scss">
@use '~scss/base/text-styles.scss';

.segmented-control {
    background: $color-gray-lighter;
    padding: $border-width;
    border-radius: $border-radius;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    position: relative;
    z-index: 0;
    overflow: hidden;
    @extend .style-input;

    & > div {
        flex-grow: 1;
        height: 34px;
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

        & > span {
            display: block;

            &::before {
                content: attr(data-text);
                position: absolute;
                left: 10px;
                right: 10px;
                top: 0;
                height: 100%;
                line-height: 34px;
                text-align: center;
                text-overflow: ellipsis;
                opacity: 1;
                overflow: hidden;
                word-wrap: none;
                white-space: nowrap;
                transition: opacity 0.25s;
            }

            &::after {
                //background: white;
                content: attr(data-text);
                position: absolute;
                left: 10px;
                right: 10px;
                top: 0;
                height: 100%;
                line-height: 34px;
                text-align: center;
                text-overflow: ellipsis;
                font-weight: 600;
                overflow: hidden;
                word-wrap: none;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.25s;
            }
        }

        &:active > span {
            &::before {
                opacity: 0.4;
            }
        }

        // Animate font weight change
        &.selected > span {
            &::before {
                opacity: 0;
            }
            &::after {
                opacity: 1;
            }
        }

        // Animate font weight change
        &.selected:active > span {
            &::after {
                opacity: 0.4;
            }
        }
    }
    & > span {
        position: absolute;
        top: $border-width;
        bottom: $border-width;
        left: $border-width;
        right: $border-width;
        z-index: -1;
        pointer-events: none;

        & > span {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            background: white;
            border-radius: 4px;
            transition: left 0.25s;
            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.25);
        }
    }
}
</style>
