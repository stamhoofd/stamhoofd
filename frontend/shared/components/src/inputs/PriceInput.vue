<template>
    <label class="price-input input" :class="{ error: !valid, disabled }">
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
            inputmode="decimal"
            step="any"
            :disabled="disabled"
            @blur="clean"
            @keydown.up.prevent="step(100)"
            @keydown.down.prevent="step(-100)"
        >
        <div v-if="!valid">
            <span>{{ valueString }}</span>
        </div>
        <div v-else-if="valueString != ''">
            <span>{{ valueString }}</span> {{ currency }}
        </div>
        <div v-else class="placeholder">{{ placeholder }}</div>
    </label>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

@Component
export default class PriceInput extends Vue {
    /** Price in cents */
    @Prop({ default: 0 })
        min!: number | null

    /** Price in cents */
    @Prop({ default: null })
        max!: number | null

    valueString = "40";
    valid = true;

    /** Price in cents */
    @Prop({ default: null })
        value!: number | null

    currency = "euro";

    @Prop({ default: "" })
        placeholder!: string

    @Prop({ default: true })
        required!: boolean

    @Prop({ default: false })
        disabled!: boolean

    @Watch('value')
    onRealValueChanged(val: number | null, old: number | null) {
        if (old === val) {
            return
        }
        const {value: currentValue} = this.stringToValue(this.valueString)

        if (currentValue === val) {
            return
        }

        if (val === null)  {
            if (this.required) {
                this.internalValue = this.constrain(this.value ?? this.min ?? 0);
            }
            this.clean();
            return;
        }

        this.internalValue = this.constrain(val);
        this.clean();
    }

    get internalValue() {
        return this.value
    }

    set internalValue(val: number | null) {
        this.$emit('update:modelValue', val)
    }

    mounted() {
        this.clean()
    }

    stringToValue(str: string) {
        // We need the value string here! Vue does some converting to numbers automatically
        // but for our placeholder system we need exactly the same string
        if (str == "") {
            if (this.required) {
                return {
                    value: Math.max(0, this.min ?? 0),
                    valid: true
                }
            } else {
                return {
                    value: null,
                    valid: true
                }
            }
        } else {
            if (!str.includes(".")) {
                // We do this for all locales since some browsers report the language locale instead of the formatting locale
                str = str.replace(",", ".");
            }
            const v = parseFloat(str);
            if (isNaN(v)) {
                return {
                    value: this.min ?? 0,
                    valid: false
                }
            } else {
                // Remove extra decimals
                return {
                    value: this.constrain(Math.round(v * 100)),
                    valid: true
                }
            }
        }
    }

    @Watch("valueString")
    onValueChanged(value: string, _oldValue: string) {
        const {valid, value: newValue} = this.stringToValue(value);
        this.valid = valid;
        this.internalValue = newValue;
    }

    /// Returns the decimal separator of the system. Might be wrong if the system has a region set different from the language with an unknown combination.
    whatDecimalSeparator(): string {
        const n = 1.1;
        const str = n.toLocaleString().substring(1, 2);
        return str;
    }

    // Restore invalid input, make the input value again
    // And set valueString
    clean() {
        if (!this.valid) {
            return;
        }

        const value = this.internalValue

        if (value === null) {
            this.valueString = ""
            return
        }

        // Check if has decimals
        const float = value / 100
        const decimals = float % 1;
        const abs = Math.abs(float);

        if (decimals != 0) {
            // Include decimals
            this.valueString =
                (float < 0 ? "-" : "") +
                Math.floor(abs) +
                this.whatDecimalSeparator() +
                (""+Math.round(Math.abs(decimals) * 100)).padStart(2, "0");
        } else {
            // Hide decimals
            this.valueString = float + "";
        }
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
        this.internalValue = this.constrain((this.value ?? this.min ?? 0) + add);
        this.$nextTick(() => {
            this.clean();
        })
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.price-input {
    position: relative;

    & > div {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;

        span {
            white-space: pre;
        }

        &.placeholder {
            opacity: 0.5;
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
