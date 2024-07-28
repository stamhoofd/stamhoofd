<template>
    <div class="stepper-input" @pointerdown.prevent>
        <button class="icon min" type="button" @click="step(-1)" />
        <hr>
        <button class="icon plus" type="button" @click="step(1)" /> 
    </div>
</template>

<script setup lang="ts">
export interface Props {
    min: number | null,
    max?: number | null
}

const model = defineModel<number>({default: 1})
const props = withDefaults(defineProps<Props>(), {
    min: 0,
    max: null
})

const constrain = (value: number): number => {
    if (props.min !== null && value < props.min) {
        value = props.min;
    } else if (props.max !== null && value > props.max) {
        value = props.max;
    }
    return value
}

const step = (add: number) => {
    console.log('step', add)
    const v = constrain(model.value + add)
    model.value = v
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.stepper-input {
    display: inline-flex;
    flex-direction: row;
    background: $color-background-shade;
    border-radius: $border-radius;
    align-items: stretch;
    height: $input-height;
    vertical-align: middle;
    contain: strict;
    width: 52px * 2 - $border-width; 

    hr {
        width: $border-width;
        flex-basis: $border-width;
        height: 19px;
        background: $color-gray-2;
        border-radius: calc($border-width / 2);
        border: 0;
        outline: 0;
        transition: opacity 0.2s;
        align-self: center;
        margin: 0;
        padding: 0;
        display: block;
    }

    &:active {
        hr {
            transition: none;
            opacity: 0;
        }
    }

    button {
        padding: 5px 14px;
        border-radius: $border-radius;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        transition: background-color 0.2s;
        touch-action: manipulation;
        user-select: none;
        cursor: pointer;
        outline: 0;
        display: block;

        &:active {
            background: $color-gray-3;
            transition: none;
        }

        &:last-child {
            margin-left: -$border-width;
        }

        &:first-child {
            margin-right: -$border-width;
        }
    }
}
</style>
