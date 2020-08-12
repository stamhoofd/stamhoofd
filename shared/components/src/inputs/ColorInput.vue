<template>
    <STInputBox :title="title" error-fields="*" :error-box="errorBox">
        <label for="color-input" class="input color-input-box" :class="{ hasColor: !!hasColor }">
            <input class="text-input" type="text" pattern="#[0-9A-Fa-f]{6}" v-model="colorRaw" :placeholder="placeholder" @change="validate" :autocomplete="autocomplete"/>
            <input id="color-input" class="color-input" type="color" pattern="#[0-9A-Fa-f]{6}" v-model="colorRaw"  @change="validate" />
            <span class="color" :style="{ backgroundColor: myColor }"/>
        </label>
    </STInputBox>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"

@Component({
    components: {
        STInputBox
    }
})
export default class ColorInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ default: null }) 
    validator: Validator | null
    

    colorRaw = "";
    hasColor = "";

    @Prop({ default: null })
    value!: string | null

    @Prop({ default: true })
    required!: boolean

    @Prop({ default: "" })
    placeholder!: string

    @Prop({ default: "email" })
    autocomplete!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.colorRaw = val
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.validate()
            })
        }

        this.colorRaw = this.value ?? ""
        this.hasColor = this.colorRaw
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    get myColor() {
        return this.hasColor ?? "black"
    }

    async validate() {
        this.colorRaw = this.colorRaw.trim().toUpperCase()

        if (!this.required && this.colorRaw.length == 0) {
            this.errorBox = null
            this.hasColor = ""

            if (this.value !== null) {
                this.$emit("input", null)
            }
            return true
        }

        if (this.colorRaw.length == 6 && !this.colorRaw.startsWith("#")) {
            this.colorRaw = "#"+this.colorRaw;
        }

        const regex = /^#[0-9A-F]{6}$/;
        
        if (!regex.test(this.colorRaw)) {
            this.hasColor = ""
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldige kleurcode",
                "field": "color"
            }))
            if (this.value !== null) {
                this.$emit("input", null)
            }
            return false

        } else {
            this.hasColor = this.colorRaw
            if (this.colorRaw !== this.value) {
                this.$emit("input", this.colorRaw)
            }
            this.errorBox = null
            return true
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;


.color-input-box {
    position: relative;
    transition: border-color 0.2s, padding-left 0.2s !important;
    padding-top: 0 !important;
    padding-bottom: 0;

    .text-input {
        width: 100%;
        height: 44px - 2 * $border-width;
        padding: 5px 0;
        line-height: 44px - 10px - 2 * $border-width;
        box-sizing: border-box;
    }

    .color-input {
        appearance: none;
        opacity: 0;
        position: absolute;
        left: 15px;
        top: 50%;
        margin-top: -5px;
        width: 10px;
        height: 10px;
        border-radius: 3px;
    }


    &.hasColor {
        padding-left: 30px;
    }

    > span {
        position: absolute;
        left: 15px;
        top: 50%;
        margin-top: -5px;
        width: 10px;
        height: 10px;
        border-radius: 3px;
    }
}
</style>
