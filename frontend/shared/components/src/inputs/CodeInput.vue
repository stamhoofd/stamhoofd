<template>
    <div class="code-input">
        <div>
            <!-- Name incluses 'search' to disable safari autocomplete, who tries to autocomplete an email in a number input?! -->
            <input 
                v-for="index in codeLength" 
                :key="index"
                ref="numberInput" 
                inputmode="numeric" 
                class="input" 
                :name="'search-code_'+index" 
                @input="onInput(index - 1)" 
                @click="selectNext(index - 1)" 
                @keyup.delete="clearInput(index - 1)" 
                @keyup.left="selectNext(index - 2)" 
                @keyup.right="selectNext(index)"
                @change="updateValue"
            >
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";

@Component
export default class CodeInput extends Vue {
    valid = true;

    @Prop({ default: "" })
    value!: string

    @Watch("value")
    onValueChanged(value: string, _oldValue: string) {
        if (value == _oldValue) {
            return
        }
        if (value == this.getInternalValue()) {
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

    get codeLength() {
        return 6
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
        input.value = (input.value as string).replace(/[^0-9]/g, '')
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
        if (input.value.length == 0 && index < this.codeLength - 1) {
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
            if (letter.length == 0) {
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

.code-input {
    -webkit-touch-callout: none !important;

    > div {
        display: inline-flex;
        flex-direction: row;

        .input {
            margin: 0 3px;
            max-width: 38px;
            padding-left: 0;
            padding-right: 0;
            text-align: center;
            font-size: 20px;
            caret-color: transparent;
            text-transform: uppercase;
            -webkit-touch-callout: none !important;

            &:nth-child(3) {
                margin-right: 15px;
            }
        }

    }
}

</style>
