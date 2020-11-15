<template>
    <div class="stepper-input">
        <button class="icon min" @click="step(-1)"/>
        <hr>
        <button class="icon plus" @click="step(1)"/> 
    </div>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component
export default class StepperInput extends Vue {
    /** Price in cents */
    @Prop({ default: 0 })
    min!: number | null

    /** Price in cents */
    @Prop({ default: null })
    max!: number | null

    valid = true;

    /** Price in cents */
    @Prop({ default: 0 })
    value!: number

    get internalValue() {
        return this.value
    }

    set internalValue(val: number) {
        this.$emit("input", val)
    }

    // Limit value to bounds
    constrain(value: number): number {
        if (this.min !== null && value < this.min) {
             value = this.min;
        } else if (this.max !== null && value > this.max) {
            value = this.max;
        }
        return value
    }

    step(add: number) {
        if (!this.valid) {
            return;
        }
        const v = this.constrain(this.internalValue + add);
        this.internalValue = v
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use "~@stamhoofd/scss/components/inputs.scss" as *;

.stepper-input {
    display: inline-flex;
    flex-direction: row;
    background: $color-white-shade;
    border-radius: $border-radius;
    align-items: stretch;
    height: $input-height;

    hr {
        width: $border-width;
        flex-basis: $border-width;
        height: 19px;
        background: $color-gray-light;
        border-radius: $border-width/2;
        border: 0;
        outline: 0;
        transition: opacity 0.2s;
        align-self: center;
        margin: 0;
        padding: 0;
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
        transition: background-color 0.2s;

        &:active {
            background: $color-gray-lighter;
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
