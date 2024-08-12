<template>
    <STInputBox :title="title" error-fields="address" :error-box="errorBox">
        <input v-model="addressLine1" class="input" type="text" placeholder="Straat en nummer" name="street-address" autocomplete="street-address" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur">
        <div class="input-group">
            <div>
                <input v-model="postalCode" class="input" type="text" placeholder="Postcode" name="postal-code" autocomplete="postal-code" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur">
            </div>
            <div>
                <input v-model="city" class="input" type="text" placeholder="Gemeente" name="city" autocomplete="address-level2" @change="updateAddress" @input="updateAddressRealTime" @focus="onFocus" @blur="onBlur"> <!-- name needs to be city for safari autocomplete -->
            </div>
        </div>

        <Dropdown v-model="country" autocomplete="country" name="country" @update:model-value="updateAddress" @focus="onFocus" @blur="onBlur">
            <option v-for="country in countries" :key="country.value" :value="country.value">
                {{ country.text }}
            </option>
        </Dropdown>
    </STInputBox>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { Component, Prop, Vue, Watch } from "@simonbackx/vue-app-navigation/classes";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Address, Country, CountryHelper, ValidatedAddress } from "@stamhoofd/structures";

import { ErrorBox } from "../errors/ErrorBox";
import { Validator } from "../errors/Validator";
import Dropdown from './Dropdown.vue';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
        Dropdown
    },
    emits: ["update:modelValue"]
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
        modelValue: Address | ValidatedAddress | null

    /**
     * Validate on the server or not? -> will return a ValidatedAddress if this is true
     */
    @Prop({ default: null })
        validateServer: Server | null

    @Prop({ default: true })
        required: boolean

    /**
     * Whether the value can be set to null if it is empty (even when it is required, will still be invalid)
     * Only used if required = false
     */
    @Prop({ default: false })
        nullable!: boolean

    addressLine1 = ""
    city = ""
    postalCode = ""
    country = this.getDefaultCountry()

    @Prop({ default: false })
        linkCountryToLocale: boolean

    getDefaultCountry() {
        return I18nController.shared?.country ?? Country.Belgium
    }

    hasFocus = false

    get countries() {
        return CountryHelper.getList()
    }

    @Watch('modelValue', { deep: true })
    onValueChanged(val: Address | null) {
        if (this.hasFocus) {
            // don't change while typing
            return;
        }

        if (!val) {
            if (!this.required && !this.pendingErrorBox && !this.errorBox) {
                this.addressLine1 = ""
                this.city = ""
                this.postalCode = ""
            }
            return
        }
        this.addressLine1 = val.street.length > 0 ? (val.street+" "+val.number) : (val.number+"")
        this.city = val.city
        this.postalCode = val.postalCode
        this.country = val.country
    }

    @Watch('required', { deep: true })
    onChangeRequired() {
        // Revalidate, because the fields might be empty, and required goes false -> send null so any saved address gets cleared
        this.isValid(false, true).catch(console.error)
    }

    updateValues(val: Address | null) {
        if (!val) {
            if (!this.required && !this.pendingErrorBox && !this.errorBox) {
                this.addressLine1 = ""
                this.city = ""
                this.postalCode = ""
            }
            return
        }
        this.addressLine1 = val.street.length > 0 ? (val.street+" "+val.number) : (val.number+"")
        this.city = val.city
        this.postalCode = val.postalCode
        this.country = val.country
    }

    onBlur() {
        this.hasFocus = false

        // Sometimes the blur happens without a onChange event, so we always need to update the address after a blur
        // it will only make the errors visible if hasFocus is still false after 200ms
        this.updateAddress()
    }

    onFocus() {
        this.hasFocus = true
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid(true, false)
            })
        }
        
        if (this.modelValue) {
            this.addressLine1 = this.modelValue.street.length > 0 ? (this.modelValue.street+" "+this.modelValue.number) : (this.modelValue.number+"")
            this.city = this.modelValue.city
            this.postalCode = this.modelValue.postalCode
            this.country = this.modelValue.country
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    async isValid(isFinal: boolean, silent = false): Promise<boolean> {
        if (!this.required && this.addressLine1.length == 0 && this.postalCode.length == 0 && this.city.length == 0) {
            if (!silent) {
                this.errorBox = null
            }

            if (this.modelValue !== null) {
                this.$emit('update:modelValue', null)
            }
            return true
        }

        if (this.required && this.addressLine1.length == 0 && this.postalCode.length == 0 && this.city.length == 0) {
            if (!isFinal) {
                if (!silent) {
                    this.errorBox = null
                }

                if (this.nullable && this.modelValue !== null) {
                    this.$emit('update:modelValue', null)
                }
                return false
            }
        }

        let address: Address

        try {
            address = Address.createFromFields(this.addressLine1, this.postalCode, this.city, this.country)

            if (!this.modelValue || (this.validateServer && !(this.modelValue instanceof ValidatedAddress) && !silent && isFinal) || address.toString() != this.modelValue.toString()) {
                // Do we need to validate on the server?
                if (this.validateServer && !silent && isFinal) {
                    const response = await this.validateServer.request({
                        method: "POST",
                        path: "/address/validate",
                        body: address,
                        decoder: ValidatedAddress as Decoder<ValidatedAddress>,
                        shouldRetry: false
                    })
                    if (!this.hasFocus) {
                        this.updateValues(response.data)
                    }
                    this.$emit('update:modelValue', response.data)
                } else {
                    if (!this.hasFocus) {
                        this.updateValues(address)
                    }
                    this.$emit('update:modelValue', address)
                }
            } else {
                if (!this.hasFocus) {
                    this.updateValues(address)
                }
            }
            
            if (!silent) {
                this.errorBox = null
                this.pendingErrorBox = null
            }
            return true
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("address")

                if (!silent) {
                    if (isFinal) {
                        this.errorBox = new ErrorBox(e)
                    } else {
                        this.pendingErrorBox = new ErrorBox(e)

                        setTimeout( () => {
                            if (!this.hasFocus) {
                                this.errorBox = this.pendingErrorBox
                            }
                        }, 200);
                    }
                }
            }

            if (!this.required && !silent) {
                this.$emit('update:modelValue', null)
            }
            return false
        }
    }

    updateAddress() {
        if (this.country && this.linkCountryToLocale && I18nController.shared && I18nController.isValidCountry(this.country)) {
            I18nController.shared.switchToLocale({ country: this.country }).catch(console.error)
        }
        this.isValid(false).catch(console.error)
    }

    /**
     * Send real time input updates, but don't update error messages
     */
    updateAddressRealTime() {
        if (this.country && this.linkCountryToLocale && I18nController.shared && I18nController.isValidCountry(this.country)) {
            I18nController.shared.switchToLocale({ country: this.country }).catch(console.error)
        }
        this.isValid(false, true).catch(console.error)
    }
}
</script>
