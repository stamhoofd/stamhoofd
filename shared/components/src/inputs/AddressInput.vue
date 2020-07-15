<template>
  <STInputBox :title="title" error-fields="address" :error-box="errorBox">
      <input v-model="addressLine1" class="input" type="text" placeholder="Straat en number" name="street-address" autocomplete="street-address" @change="updateAddress" @focus="onFocus" @blur="onBlur">
        <div class="input-group">
            <div>
                <input v-model="postalCode" class="input" type="text" placeholder="Postcode" name="postal-code" autocomplete="postal-code" @change="updateAddress" @focus="onFocus" @blur="onBlur">
            </div>
            <div>
                <input v-model="city" class="input" type="text" placeholder="Gemeente" name="city" autocomplete="address-level2" @change="updateAddress" @focus="onFocus" @blur="onBlur"> <!-- name needs to be city for safari autocomplete -->
            </div>
        </div>

        <select v-model="country" class="input" @change="updateAddress" @focus="onFocus" @blur="onBlur" autocomplete="country" name="country">
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
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType} from "@stamhoofd/structures"
import { Vue, Prop, Component, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox
    }
})
export default class SignupGeneralView extends Vue {
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
    value: Address | null

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
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    isValid(): boolean {
        let address: Address

        try {
            address = Address.createFromFields(this.addressLine1, this.postalCode, this.city, this.country)
            this.$emit("input", address)
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