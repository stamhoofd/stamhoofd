<template>
    <SaveView :save-text="'Opslaan'" title="Adres" :loading="loading" @save="save">
        <h1>
            Adres bewerken
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />
        <AddressInput v-model="editAddress" title="Adres" :validator="validator" :required="true" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, Dropdown, EmailInput, ErrorBox, PhoneInput, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { Address } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STInputBox,
        PhoneInput,
        EmailInput,
        AddressInput,
        Dropdown
    }
})
export default class AddressView extends Mixins(NavigationMixin) {
    @Prop({ required: true})
        address!: Address
    errorBox: ErrorBox | null = null

    editAddress = Address.create(this.address)
    validator = new Validator()
    loading = false

    
    
    @Prop({ required: true })
        handler: (parent: Address, component: AddressView) => Promise<void>|undefined;


    modifyAddress({ from, to }: { from: Address, to: Address }) {
        this.$memberManager.updateAddress(from, to)
    }

    async save() {
        if (this.loading) {
            return;
        }

        this.loading = true;
        const valid = await this.validator.validate()

        if (!valid) {
            this.loading = false;
            return;
        }

        this.$memberManager.updateAddress(this.address, this.editAddress)

        try {
            await this.handler(this.editAddress, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false;
    }
}
</script>