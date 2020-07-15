<template>
  <div>
      <input v-model="addressLine1" class="input" type="text" placeholder="Straat en number" autocomplete="address-line1" @change="updateAddress">
        <div class="input-group">
            <div>
                <input v-model="postalCode" class="input" type="text" placeholder="Postcode" autocomplete="postal-code" @change="updateAddress">
            </div>
            <div>
                <input v-model="city" class="input" type="text" placeholder="Gemeente" autocomplete="city" @change="updateAddress">
            </div>
        </div>

        <select v-model="country" class="input" @change="updateAddress">
            <option value="BE">
                België
            </option>
            <option value="NL">
                Nederland
            </option>
        </select>
  </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType} from "@stamhoofd/structures"
import { Vue, Prop, Component, Watch } from "vue-property-decorator";

@Component({
    components: {}
})
export default class SignupGeneralView extends Vue {
    @Prop({ default: null })
    value: Address | null

    addressLine1 = ""
    city = ""
    postalCode = ""
    country: Country = "BE"

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

    updateAddress() {
        let address: Address

        try {
            address = Address.createFromFields(this.addressLine1, this.postalCode, this.city, this.country)
            this.$emit("input", address)
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("address")
            }
            this.$emit("input", null)
            throw e;
        }

    }
}
</script>