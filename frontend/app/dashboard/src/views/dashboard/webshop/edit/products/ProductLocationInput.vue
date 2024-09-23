<template>
    <div class="product-location-input">
        <STInputBox title="Locatienaam" error-fields="name" :error-box="errorBox">
            <input v-model="name" placeholder="bv. Gemeentelijke feestzaal" class="input">
        </STInputBox>
        <AddressInput v-model="address" title="Adres (optioneel)" :validator="validator" :required="false" />
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent } from "@simonbackx/vue-app-navigation/classes";
import { AddressInput, ErrorBox, STInputBox, Validator } from "@stamhoofd/components";
import { Address, ProductLocation } from "@stamhoofd/structures";

@Component({
    components: {
        STInputBox,
        AddressInput
    }
})
export default class ProductLocationInput extends VueComponent {
    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null
    
    @Prop({ default: null })
        modelValue: ProductLocation | null

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid()
            })
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    get name() {
        return this.modelValue?.name ?? ""
    }

    set name(name: string) {
        if (this.modelValue) {
            this.$emit('update:modelValue', this.modelValue.patch({ name }))
        }
    }

    get address() {
        return this.modelValue?.address ?? null
    }

    set address(address: Address | null) {
        if (this.modelValue) {
            this.$emit('update:modelValue', this.modelValue.patch({ address }))
        }
    }

    async isValid(): Promise<boolean> {
        await Promise.resolve()
        if (this.name.length < 2) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "invalid_field",
                field: "name",
                message: "Vul een locatienaam in"
            }))
            return false
        }

        return true
    }
}
</script>
