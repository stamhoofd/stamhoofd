<template>
    <div class="code-input">
        <div>
            <input 
                v-for="index in codeLength" 
                :key="index"
                ref="numberInput" 
                type="text"
                inputmode="decimal" 
                class="input" 
                autocomplete="no"
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
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

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
        for (let index = 0; index < this.codeLength; index++) {
            const element = this.$refs.numberInput[index];
            
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
        const input = this.$refs.numberInput[index];
        input.value = (input.value as string).replace(/\s/g, '')
        if (input.value.length >= 1) {
            this.selectNext(index + 1)
        }
    }

    clearInput(index: number, select = true) {
        // Move everything one to the left
        const input = this.$refs.numberInput[index];
        if (input.value.length == 0 && index < this.codeLength - 1) {
            input.value = this.$refs.numberInput[index + 1].value;
            this.$refs.numberInput[index + 1].value = ""
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

        console.log("select next ", index)
        if (index >= this.codeLength) {
            const prev = this.$refs.numberInput[index - 1];
            const val = prev.value;
            if (val.length > 1) {
                prev.value = val.substr(0, 1)
            }
            for (let index = 0; index < this.codeLength; index++) {
                const element = this.$refs.numberInput[index];
                element.blur()
            }
            this.updateValue()

            if (this.getInternalValue().length === this.codeLength) {
                this.$emit("complete")
            }
            return
        }
        if (index >= 1) {
            const prev = this.$refs.numberInput[index - 1];
            const val = prev.value;
            if (val.length > 1) {
                prev.value = val.substr(0, 1)
                this.$refs.numberInput[index].value = val.substr(1)
                this.selectNext(index + 1)
                return
            }
        }
        this.$refs.numberInput[index].focus()
        this.$refs.numberInput[index].select()
        this.updateValue()
    }

    getInternalValue() {
        let val = ""
        for (let index = 0; index < this.codeLength; index++) {
            const element = this.$refs.numberInput[index];
            const letter = element.value.substr(0, 1).toUpperCase()
            val += letter
            if (letter.length == 0) {
                break
            }
        }
        return val
    }

    updateValue() {
        this.$emit("input", this.getInternalValue())
    }

}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use "~@stamhoofd/scss/components/inputs.scss";

.code-input {
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
            //user-select: none;

            &::selection {
                //background: transparent
            }

            &:nth-child(3) {
                margin-right: 15px;
            }
        }

    }
}

</style>
