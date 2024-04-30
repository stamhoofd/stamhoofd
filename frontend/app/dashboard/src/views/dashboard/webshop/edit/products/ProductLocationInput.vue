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
import { AddressInput,ErrorBox, STInputBox, Validator } from "@stamhoofd/components"
import { Address, ProductLocation} from "@stamhoofd/structures"
import { Component, Prop, Vue } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        AddressInput
    }
})
export default class ProductLocationInput extends Vue {
    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null
    
    @Prop({ default: null })
    value: ProductLocation | null

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
        return this.value?.name ?? ""
    }

    set name(name: string) {
        if (this.value) {
            this.$emit('update:modelValue', this.value.patch({ name }))
        }
    }

    get address() {
        return this.value?.address ?? null
    }

    set address(address: Address | null) {
        if (this.value) {
            this.$emit('update:modelValue', this.value.patch({ address }))
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