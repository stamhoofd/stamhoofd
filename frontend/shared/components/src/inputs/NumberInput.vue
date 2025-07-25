<template>
    <div class="number-container">
        <label class="number-input input" :class="{ error: !valid }">
            <!--
                We use type = text here because the specs of number inputs ensure that we can't get
                the raw string value, but we need this for our placeholder logic.
                Also inputmode is more specific on mobile devices.
                Only downside is that we lose the stepper input on desktop.
            -->
            <input
                ref="input"
                v-model="valueString"
                :disabled="disabled"
                type="text"
                :inputmode="floatingPoint ? 'decimal' : 'numeric'"
                step="any"
                @blur="clean"
                @keydown.up.prevent="step(1)"
                @keydown.down.prevent="step(-1)"
            >
            <div v-if="!valid">
                <span>{{ valueString }}</span>
            </div>
            <div v-else-if="valueString !== ''">
                <span>{{ valueString }}</span> {{ internalValue === 1 && suffixSingular !== null ? suffixSingular : suffix }}
            </div>
            <div v-else class="placeholder">{{ placeholder }}</div>
        </label>
        <StepperInput v-if="stepper" v-model="stepperValue" :min="min" :max="max" />
    </div>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import StepperInput from './StepperInput.vue';

@Component({
    components: {
        StepperInput,
    },
    emits: ['update:modelValue'],
})
export default class NumberInput extends VueComponent {
    /** Price in cents */
    @Prop({ default: 0 })
    min!: number | null;

    /** Price in cents */
    @Prop({ default: null })
    max!: number | null;

    @Prop({ default: false })
    stepper!: boolean;

    valueString = '';
    valid = true;

    /** Price in cents */
    @Prop({ default: true })
    required!: boolean;

    @Prop({ default: false })
    disabled!: boolean;

    /** Price in cents */
    @Prop({ default: 0 })
    modelValue!: number | null;

    @Prop({ default: '' })
    suffix: string;

    @Prop({ default: null })
    suffixSingular: string | null;

    @Prop({ default: '' })
    placeholder!: string;

    @Prop({ default: false })
    floatingPoint!: boolean; // In cents if floating point, never returns floats!

    @Watch('value')
    onValueChange() {
        this.clean();
    }

    get internalValue() {
        return this.modelValue;
    }

    set internalValue(val: number | null) {
        if (val === this.modelValue) {
            return;
        }
        this.$emit('update:modelValue', val);
    }

    get stepperValue() {
        return this.modelValue ?? this.min ?? 0;
    }

    set stepperValue(val: number) {
        this.$emit('update:modelValue', val);
        this.$nextTick(() => {
            this.clean();
        });
    }

    mounted() {
        this.clean();
    }

    @Watch('valueString')
    onValueChanged(value: string, _oldValue: string) {
        // We need the value string here! Vue does some converting to numbers automatically
        // but for our placeholder system we need exactly the same string
        if (value === '') {
            if (this.required) {
                this.valid = true;
                this.internalValue = Math.max(0, this.min ?? 0);
            }
            else {
                this.valid = true;
                this.internalValue = null;
            }
        }
        else {
            if (!value.includes('.')) {
                // We do this for all locales since some browsers report the language locale instead of the formatting locale
                value = value.replace(',', '.');
            }
            const v = parseFloat(value);
            if (isNaN(v)) {
                this.valid = false;
                this.internalValue = this.min ?? 0;
            }
            else {
                this.valid = true;

                // Remove extra decimals
                this.internalValue = this.constrain(Math.round(v * (this.floatingPoint ? 100 : 1)));
            }
        }
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
        if (!this.valid || (this.modelValue === null && this.required)) {
            return;
        }

        let value = this.modelValue;
        if (value === null) {
            if (!this.required) {
                this.valueString = '';
                return;
            }
            value = this.min ?? 0;
        }

        // Check if has decimals
        const float = value / (this.floatingPoint ? 100 : 1);
        const decimals = float % 1;
        const abs = Math.abs(float);

        if (decimals !== 0) {
            // Include decimals
            this.valueString
                = (float < 0 ? '-' : '')
                + Math.floor(abs)
                + this.whatDecimalSeparator()
                + ('' + Math.round(Math.abs(decimals) * (this.floatingPoint ? 100 : 1))).padStart(2, '0');
        }
        else {
            // Hide decimals
            this.valueString = float + '';
        }
    }

    // Limit value to bounds
    constrain(value: number): number {
        if (this.min !== null && value < this.min) {
            value = this.min;
        }
        else if (this.max !== null && value > this.max) {
            value = this.max;
        }
        return value;
    }

    step(add: number) {
        if (!this.valid) {
            return;
        }
        const v = this.constrain((this.internalValue ?? this.min ?? 0) + add);
        this.internalValue = v;
        this.$nextTick(() => {
            this.clean();
        });
    }

    focus() {
        // (this.$refs["input"] as any).focus()
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.number-container {
    display: flex;

    &.option {
        margin-top: 7px
    }

    .number-input {
        min-width: 0;
    }

    .stepper-input {
        margin-left: 5px;
        min-width: 0;
        flex-shrink: 0;
    }
}
.number-input {
    position: relative;

    & > div {
        pointer-events: none;
        user-select: none;
        white-space: nowrap;

        span {
            white-space: pre;
        }
    }

    .placeholder {
        color: $color-gray-5;
        opacity: 1;
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
