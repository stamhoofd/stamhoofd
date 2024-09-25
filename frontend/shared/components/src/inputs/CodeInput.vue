<template>
    <div class="code-input">
        <div :class="{small: codeLength > 6}">
            <!-- Name incluses 'search' to disable safari autocomplete, who tries to autocomplete an email in a number input?! -->
            <template v-for="index in codeLength" :key="index">
                <input 
                    ref="numberInput" 
                    :inputmode="numbersOnly ? 'numeric' : undefined" 
                    class="input" 
                    :class="{small: codeLength > 6}"
                    autocomplete="one-time-code"
                    :name="'search-code_'+index" 
                    @input="onInput(index - 1)" 
                    @click="selectNext(index - 1)" 
                    @keyup.delete="clearInput(index - 1)" 
                    @keyup.left="selectNext(index - 2)" 
                    @keyup.right="selectNext(index)"
                    @change="updateValue"
                >
                <span v-if="index%spaceLength === 0 && index !== codeLength" class="bump">-</span>
                <span v-if="index%(spaceLength*2) === 0 && index !== codeLength" class="break"></span>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, VueComponent, Watch } from "@simonbackx/vue-app-navigation/classes";

@Component({
    emits: ['update:modelValue', 'complete']
})
export default class CodeInput extends VueComponent {
    valid = true;

    @Prop({ default: "" })
        modelValue!: string

    @Prop({ default: 6 })
        codeLength!: number

    @Prop({ default: 3 })
        spaceLength!: number

    @Prop({ default: true })
        numbersOnly!: boolean

    @Watch("modelValue")
    onValueChanged(value: string, _oldValue: string) {
        if (value === _oldValue) {
            return
        }
        if (value === this.getInternalValue()) {
            return
        }
        if (!(this.$refs && this.$refs.numberInput && Array.isArray(this.$refs.numberInput))) {
            return
        }
        for (let index = 0; index < this.codeLength; index++) {
            const element = this.$refs.numberInput[index] as HTMLInputElement;
            
            if (index < value.length) {
                const letter = value[index]
                element.value = letter
            } else {
                element.value = ""
            }
        }
    }

    mounted() {
        setTimeout(() => {
            this.selectNext(0)
        }, 300)
    }

    onInput(index: number) {
        if (!(this.$refs && this.$refs.numberInput && Array.isArray(this.$refs.numberInput))) {
            return
        }

        const input = this.$refs.numberInput[index] as HTMLInputElement;
        input.value = this.numbersOnly ? (input.value as string).replace(/[^0-9]/g, '') : (input.value as string).toLocaleUpperCase().replace(/[^0-9A-Z]/g, '')
        if (input.value.length >= 1) {
            this.selectNext(index + 1)
        }
    }

    clearInput(index: number, select = true) {
        if (!(this.$refs && this.$refs.numberInput && Array.isArray(this.$refs.numberInput))) {
            return
        }

        // Move everything one to the left
        const input = this.$refs.numberInput[index] as HTMLInputElement;
        if (input.value.length === 0 && index < this.codeLength - 1) {
            input.value = (this.$refs.numberInput[index + 1] as HTMLInputElement).value;
            (this.$refs.numberInput[index + 1] as HTMLInputElement).value = ""
            this.clearInput(index + 1, false)
        }

        if (select) {
            if (index > 0) {
                this.selectNext(index - 1)
            } else {
                // reselect
                this.selectNext(index)
            }
            this.updateValue()
        }
    }

    selectNext(index: number) {
        if (index < 0) {
            return
        }

        if (!(this.$refs && this.$refs.numberInput && Array.isArray(this.$refs.numberInput))) {
            return
        }

        console.log("select next ", index)
        if (index >= this.codeLength) {
            const prev = this.$refs.numberInput[index - 1] as HTMLInputElement;
            const val = prev.value;
            if (val.length > 1) {
                prev.value = val.substr(0, 1)
            }
            for (let index = 0; index < this.codeLength; index++) {
                const element = this.$refs.numberInput[index] as HTMLInputElement;
                element.blur()
            }
            this.updateValue()

            if (this.getInternalValue().length === this.codeLength) {
                this.$emit("complete")
            }
            return
        }
        if (index >= 1) {
            const prev = this.$refs.numberInput[index - 1] as HTMLInputElement;
            const val = prev.value;
            if (val.length > 1) {
                prev.value = val.substr(0, 1);
                (this.$refs.numberInput[index] as HTMLInputElement).value = val.substr(1)
                this.selectNext(index + 1)
                return
            }
        }
        (this.$refs.numberInput[index] as HTMLInputElement).focus();

        if ((this.$refs.numberInput[index] as HTMLInputElement).value.length > 0) {
            // iOS fix
            (this.$refs.numberInput[index] as HTMLInputElement).select();
        }
        this.updateValue()
    }

    getInternalValue() {
        if (!(this.$refs && this.$refs.numberInput && Array.isArray(this.$refs.numberInput))) {
            return ""
        }

        let val = ""
        for (let index = 0; index < this.codeLength; index++) {
            const element = this.$refs.numberInput[index] as HTMLInputElement;
            const letter = element.value.substr(0, 1).toUpperCase()
            val += letter
            if (letter.length === 0) {
                break
            }
        }
        return val
    }

    updateValue() {
        this.$emit('update:modelValue', this.getInternalValue())
    }

}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;

.code-input {
    -webkit-touch-callout: none !important;

    > div {
        display: inline-flex;
        flex-direction: row;

        .input {
            margin: 0 2px;
            max-width: 32px;
            padding-left: 0;
            padding-right: 0;
            text-align: center;
            font-size: 20px;
            caret-color: transparent;
            text-transform: uppercase;
            -webkit-touch-callout: none !important;
        }

        .bump {
            width: 15px;
            align-self: center;
            text-align: center;
            font-size: 20px;
            line-height: 1;
            font-weight: $font-weight-default;
            color: $color-gray-text;
        }

        &.small {
            flex-wrap: wrap;
            row-gap: 5px;

            @media (max-width: 600px) {
                .break {
                    width: auto;
                    flex-basis: 100%;
                    opacity: 0;
                    height: 0;
                }
            }
        }

    }
}

</style>
