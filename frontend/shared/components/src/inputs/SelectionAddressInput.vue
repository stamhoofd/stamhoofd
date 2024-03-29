<template>
    <div>
        <STInputBox v-if="addresses.length > 0" title="Kies een adres" :error-box="errorBox" error-fields="selectedAddress">
            <STList>
                <STListItem v-for="_address in addresses" :key="_address.toString()" element-name="label" :selectable="true" class="left-center address-selection">
                    <Radio slot="left" v-model="selectedAddress" :value="_address" @change="changeSelected" />
                    {{ _address.street }} {{ _address.number }}<br>
                    {{ _address.postalCode }} {{ _address.city }}
                    <button slot="right" class="button icon gray edit" type="button" @click.stop="doEditAddress(_address)" />
                </STListItem>
                <STListItem element-name="label" :selectable="true" class="left-center">
                    <Radio slot="left" v-model="selectedAddress" :value="null" @change="changeSelected" />
                    Een ander adres ingeven
                </STListItem>
            </STList>
        </STInputBox>
        <AddressInput v-if="editingAddress || selectedAddress === null" v-model="editAddress" :title="selectedAddress === null ? 'Nieuw adres' : 'Adres bewerken'" :validator="internalValidator" :required="false" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>


<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput,ErrorBox, Radio,STErrorsDefault, STInputBox, STList,STListItem,Validator } from "@stamhoofd/components"
import { Address, ValidatedAddress} from "@stamhoofd/structures"
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        STListItem,
        STErrorsDefault,
        Radio,
        AddressInput,
        STList
    }
})
export default class SelectionAddressInput extends Vue {
    @Prop({ required: true }) 
    addresses: Address[];

    @Prop({ default: true })
    required: boolean

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null

    internalValidator = new Validator()
    
    @Prop({ default: null })
    value: Address | ValidatedAddress | null

    selectedAddress: Address | null = null
    customAddress: Address | null = null
    editingAddress = false

    @Watch('value')
    onValueChanged(val: Address | null) {
        if (val === this.selectedAddress ?? this.customAddress ?? null) {
            // Not changed
            return
        }

        if (!val) {
            if (!this.required) {
                this.selectedAddress = null
                this.editingAddress = false
                this.customAddress = null
            }
            return
        }
        
        const a = this.addresses.find(aa => aa.toString() == val.toString())
        if (a) {
            this.selectedAddress = a
            this.editingAddress = false
            this.customAddress = null
        } else {
            this.selectedAddress = null
            this.editingAddress = false
            this.customAddress = val
        }
    }

    mounted() {
        const a = this.addresses.find(aa => aa.toString() == this.value?.toString())
        if (a) {
            this.selectedAddress = a
            this.editingAddress = false
            this.customAddress = null
        } else {
            this.selectedAddress = null
            this.editingAddress = false
            this.customAddress = this.value

            if (this.required && !this.value && this.addresses.length > 0) {
                this.$emit("input", this.addresses[0])
            }
        }

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

    changeSelected() {
        if (this.editingAddress) {
            this.customAddress = null
        }
        this.editingAddress = false

        const a = this.selectedAddress ?? this.customAddress
        if (a) {
            this.$emit("input", a)
        } else {
            if (!this.required) {
                this.$emit("input", null) 
            }
        }
    }

    doEditAddress(address: Address) {
        this.$emit("input", address)
        this.editingAddress = true
        this.selectedAddress = address
        this.customAddress = address
    }

    get editAddress() {
        return this.customAddress
    }

    set editAddress(address: Address | null) {
        if (this.editingAddress && this.selectedAddress && address) {
            this.$emit("modify", { from: this.selectedAddress, to: address })
            this.selectedAddress = address
            this.$emit("input", address)
            this.editingAddress = true
        }
        this.customAddress = address
    }

    async isValid(): Promise<boolean> {
        const isValid = await this.internalValidator.validate()
        if (!isValid) {
            this.errorBox = null
            return false
        }

        if (this.selectedAddress) {
            this.$emit("input", this.selectedAddress)
            this.errorBox = null
            return true
        }

        if (this.required && !this.customAddress) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "invalid_field",
                message: "Vul een adres in",
                field: "address"
            }))
            return false
        }
        
        this.errorBox = null
        this.$emit("input", this.customAddress)
        return true
    }
}
</script>