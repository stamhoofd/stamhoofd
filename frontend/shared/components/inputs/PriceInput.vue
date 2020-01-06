<template>
    <label class="price-input">
        <!-- We use type = text here because the specs of number make that we can't get the raw string value, we need this -->
        <input type="text" inputmode="decimal" step="any" v-model="valueString" ref="input">
        <div v-if="isNaN(value)"><span>{{ valueString }}</span></div>
        <div v-else-if="valueString != ''"><span>{{ valueString }}</span> {{ currency }}</div>
        <div v-else>Gratis</div>
    </label>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component
export default class PriceInput extends Vue {
    min: number = 0;
    max?: number = null;
    valueString: string = "40";
    value: number = 40;
    currency: string = 'euro';

    placeholder: string = "Gratis";

    @Watch('valueString') 
    onValueChanged(value: string, oldValue: string) {
        // We need the value string here! Vue does some converting to numbers automatically
        // but for our placeholder system we need exactly the same string
        if (value == "") {
            this.value = 0;
        } else {
            this.value = parseFloat(value);
        }
    }
   
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
    @use "~@shared/scss/base/variables.scss";
    @use "~@shared/scss/components/inputs.scss";

    .price-input {
        @extend .input;
        position: relative;

        &> div {
            pointer-events: none;
        }
        
        &> input {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
            opacity: 0;
            width: 100%;
            box-sizing: border-box;
            padding: 5px 15px;
            height: 44px - 2*$border-width;
            line-height: 44px - 10px - 2*$border-width;

            &:focus {
                opacity: 1;

                &+ div {
                    opacity: 0.5;

                    span {
                        visibility: hidden;
                    }
                }
            }
        }
    }
</style>
