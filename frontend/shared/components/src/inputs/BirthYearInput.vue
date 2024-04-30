<template>
    <label class="birth-year-input input" :class="{ error: !valid }">
        <!-- 
            We use type = text here because the specs of number inputs ensure that we can't get 
            the raw string value, but we need this for our placeholder logic.
            Also inputmode is more specific on mobile devices. 
            Only downside is that we lose the stepper input on desktop.
        -->
        <input
            ref="input"
            v-model="valueString"
            type="text"
            inputmode="numeric"
            step="any"
            @blur="clean"
            @keydown.up.prevent="step(1)"
            @keydown.down.prevent="step(-1)"
        >
        <div v-if="!valid">
            <span>{{ valueString }}</span>
        </div>
        <div v-else-if="valueString != ''">
            <span>{{ valueString }}</span> {{ descriptionText }}
        </div>
        <div v-else>{{ placeholder }}</div>
    </label>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component
export default class PriceInput extends Vue {
    @Prop({ default: 1910 })
    min!: number

    @Prop({ default: false })
    nullable!: boolean

    @Prop({ default: new Date().getFullYear() })
    max!: number | null

    valueString = "";
    valid = true;

    /** Price in cents */
    @Prop({ default: null })
    value!: number | null

    @Prop({ default: "" })
    placeholder!: string

    get internalValue() {
        return this.value
    }

    set internalValue(val: number | null) {
        this.$emit('update:modelValue', val)
    }

    get descriptionText() {
        if (!this.value) {
            return ""
        }
        return "("+(new Date().getFullYear() - this.value)+" jaar)"
    }

    mounted() {
        this.clean()
    }

    @Watch("valueString")
    onValueChanged(value: string, _oldValue: string) {
        // We need the value string here! Vue does some converting to numbers automatically
        // but for our placeholder system we need exactly the same string
        if (value == "") {
            this.valid = true;
            if (this.nullable) {
                this.internalValue = null
            } else {
                this.internalValue = Math.max(0, this.min);
            }
        } else {
            const v = parseInt(value);
            if (isNaN(v)) {
                this.valid = false;

                if (this.nullable) {
                    this.internalValue = null
                } else {
                    this.internalValue = this.min;
                }
            } else {
                this.valid = true;

                // Remove extra decimals
                this.internalValue = this.constrain(v);
            }
        }
    }

    // Restore invalid input, make the input value again
    // And set valueString
    clean() {
        if (!this.valid) {
            return;
        }
        if (this.internalValue === null) {
            this.valueString = ""
            return
        }
        // Check if has decimals
        this.valueString = Math.floor(this.internalValue) + "";
    }

    // Limit value to bounds
    constrain(value: number): number {
        value = Math.max(this.min, value);
        if (this.max !== null && value > this.max) {
            value = this.max;
        }
        return value
    }

    step(add: number) {
        if (!this.valid) {
            return;
        }
        if (this.internalValue === null) {
            return;
        }
        const val = this.constrain(this.internalValue + add);
        this.valueString = Math.floor(val) + "";
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.birth-year-input {
    position: relative;

    & > div {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;

        span {
            white-space: pre;
        }
    }

    & > input {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        opacity: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 5px 15px;
        height:  calc(#{$input-height} - 2 * #{$border-width});
        line-height: calc(#{$input-height} - 10px - 2 * #{$border-width});

        &:focus {
            opacity: 1;

            & + div {
                opacity: 0.5;

                span {
                    visibility: hidden;
                }
            }
        }
    }
}
</style>
