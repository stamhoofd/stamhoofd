<template>
    <div class="code-container">
        <input 
            v-for="index in codeLength" 
            :key="index"
            ref="numberInput" 
            type="text"
            inputmode="decimal" 
            class="input" 
            @input="onInput(index - 1)" 
            @click="selectNext(index - 1)" 
            @keyup.delete="clearInput(index - 1)" 
            @keyup.left="selectNext(index - 2)" 
            @keyup.right="selectNext(index)"
        >
    </div>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";

import StepperInput from "./StepperInput.vue"

@Component({
    components: {
        StepperInput
    }
})
export default class CodeInput extends Vue {
    valueString = "";
    valid = true;

    /** Price in cents */
    @Prop({ default: "" })
    value!: string

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
        if (input.value.length >= 1) {
            this.selectNext(index + 1)
        }
    }

    clearInput(index: number) {
        console.log("clear")
        if (index > 0) {
            this.selectNext(index - 1)
        }
    }

    selectNext(index: number) {
        console.log("select next ", index)
        if (index >= this.codeLength) {
            const prev = this.$refs.numberInput[index - 1];
            const val = prev.value;
            if (val.length > 1) {
                prev.value = val.substr(0, 1)
            }
            prev.blur();
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
    }

}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use "~@stamhoofd/scss/components/inputs.scss";

.code-container {
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

        &::selection {
            background: transparent
        }

        &:nth-child(3) {
            margin-right: 15px;
        }
    }

}
</style>
