<template>
    <label class="price-input" :class="{ error: !valid }">
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
            @blur="clean"
            @keydown.up.prevent="step(1)"
            @keydown.down.prevent="step(-1)"
        >
        <div v-if="!valid">
            <span>{{ valueString }}</span>
        </div>
        <div v-else-if="valueString != ''">
            <span>{{ valueString }}</span> {{ currency }}
        </div>
        <div v-else>{{ placeholder }}</div>
    </label>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";

@Component
export default class PriceInput extends Vue {
    min = 0;
    max?: number = null;
    valueString = "40";
    valid = true;
    value = 40;
    currency = "euro";

    placeholder = "Gratis";

    @Watch("valueString")
    onValueChanged(value: string, _oldValue: string) {
        // We need the value string here! Vue does some converting to numbers automatically
        // but for our placeholder system we need exactly the same string
        if (value == "") {
            this.valid = true;
            this.value = Math.max(0, this.min);
        } else {
            if (!value.includes(".")) {
                // We do this for all locales since some browsers report the language locale instead of the formatting locale
                value = value.replace(",", ".");
            }
            const v = parseFloat(value);
            if (isNaN(v)) {
                this.valid = false;
                this.value = this.min;
            } else {
                this.valid = true;

                // Remove extra decimals
                this.value = Math.round(v * 100) / 100;
                this.constrain();
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
        if (!this.valid) {
            return;
        }
        // Check if has decimals
        const decimals = this.value % 1;
        const abs = Math.abs(this.value);

        if (decimals != 0) {
            // Include decimals
            this.valueString =
                (this.value < 0 ? "-" : "") +
                Math.floor(abs) +
                this.whatDecimalSeparator() +
                Math.round(Math.abs(decimals) * 100);
        } else {
            // Hide decimals
            this.valueString = this.value + "";
        }
    }

    // Limit value to bounds
    constrain() {
        this.value = Math.max(this.min, this.value);
        if (this.max && this.value > this.max) {
            this.value = this.max;
        }
    }

    step(add: number) {
        if (!this.valid) {
            return;
        }
        this.clean();
        this.value += add;
        this.constrain();

        this.clean();
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~scss/base/variables.scss";
@use "~scss/components/inputs.scss";

.price-input {
    @extend .input;
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
        height: 44px - 2 * $border-width;
        line-height: 44px - 10px - 2 * $border-width;

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
