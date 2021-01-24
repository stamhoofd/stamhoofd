<template>
    <STInputBox :title="title" error-fields="address" :error-box="errorBox">
        <input v-model="addressLine1" class="input" type="text" placeholder="Straat en nummer" name="street-address" autocomplete="street-address" @change="updateAddress" @focus="onFocus" @blur="onBlur">
        <div class="input-group">
            <div>
                <input v-model="postalCode" class="input" type="text" placeholder="Postcode" name="postal-code" autocomplete="postal-code" @change="updateAddress" @focus="onFocus" @blur="onBlur">
            </div>
            <div>
                <input v-model="city" class="input" type="text" placeholder="Gemeente" name="city" autocomplete="address-level2" @change="updateAddress" @focus="onFocus" @blur="onBlur"> <!-- name needs to be city for safari autocomplete -->
            </div>
        </div>

        <select v-model="country" class="input" autocomplete="country" name="country" @change="updateAddress" @focus="onFocus" @blur="onBlur">
            <option value="BE">
                België
            </option>
            <option value="NL">
                Nederland
            </option>
        </select>
    </STInputBox>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Address, Country, ValidatedAddress} from "@stamhoofd/structures"
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class AddressInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null
    pendingErrorBox: ErrorBox | null = null
    
    @Prop({ default: null })
    value: Address | ValidatedAddress | null

    /**
     * Validate on the server or not? -> will return a ValidatedAddress if this is true
     */
    @Prop({ default: null })
    validateServer: Server | null

    @Prop({ default: true })
    required: boolean

    addressLine1 = ""
    city = ""
    postalCode = ""
    country: Country = "BE"

    hasFocus = false

    @Watch('value', { deep: true })
    onValueChanged(val: Address | null) {
        if (!val) {
            return
        }
        this.addressLine1 = val.street+" "+val.number
        this.city = val.city
        this.postalCode = val.postalCode
        this.country = val.country
    }

    onBlur() {
        this.hasFocus = false
    }

    onFocus() {
        this.hasFocus = true
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid()
            })
        }

        if (this.value) {
            this.addressLine1 = this.value.street+" "+this.value.number
            this.city = this.value.city
            this.postalCode = this.value.postalCode
            this.country = this.value.country
        }
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async isValid(): Promise<boolean> {
        if (!this.required && this.addressLine1.length == 0 && this.postalCode.length == 0 && this.city.length == 0) {
            this.errorBox = null

            if (this.value !== null) {
                this.$emit("input", null)
            }
            return true
        }

        let address: Address

        try {
            address = Address.createFromFields(this.addressLine1, this.postalCode, this.city, this.country)

            // Do we need to validate on the server?
            if (this.validateServer) {
                const response = await this.validateServer.request({
                    method: "POST",
                    path: "/address/validate",
                    body: address,
                    decoder: ValidatedAddress as Decoder<ValidatedAddress>
                })
                this.$emit("input", response.data)
            } else {
                this.$emit("input", address)
            }
            
            this.errorBox = null
            this.pendingErrorBox = null
            return true
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("address")
                this.pendingErrorBox = new ErrorBox(e)

                setTimeout( () => {
                    if (!this.hasFocus) {
                        this.errorBox = this.pendingErrorBox
                    }
                }, 200);
            }
            this.$emit("input", null)
            return false
        }
    }

    updateAddress() {
       this.isValid()
    }
}
</script>