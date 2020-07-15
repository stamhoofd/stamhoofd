<template>
    <STInputBox :title="title" error-fields="phone" :error-box="errorBox">
        <input class="input" :class="{ error: !valid }" v-model="phoneRaw" :placeholder="placeholder" @change="validate"/>
    </STInputBox>
</template>

<script lang="ts">
import { Component, Prop,Vue, Watch } from "vue-property-decorator";
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, STInputBox } from "@stamhoofd/components"

@Component({
    components: {
        STInputBox
    }
})
export default class PhoneInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    phoneRaw = "";
    valid = true;

    @Prop({ default: null })
    value!: string | null

    @Prop({ default: "" })
    placeholder!: string

    errorBox: ErrorBox | null = null

    @Watch('value')
    onValueChanged(val: string | null) {
        if (val === null) {
            return
        }
        this.phoneRaw = val
    }

    async validate() {
        this.$emit("input", null)
        const libphonenumber = await import("libphonenumber-js")
        const phoneNumber = libphonenumber.parsePhoneNumberFromString(this.phoneRaw, "BE")

        if (!phoneNumber || !phoneNumber.isValid()) {
            this.errorBox = new ErrorBox(new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig GSM-nummer",
                "field": "phone"
            }))
            this.$emit("input", null)

        } else {
            this.$emit("input", phoneNumber.formatInternational())
            this.errorBox = null
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;

</style>
