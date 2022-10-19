<template>
    <SaveView :save-text="'Opslaan'" title="Adres" @save="save">
        <h1>
            Adres bewerken
        </h1>

        <AddressInput v-model="editAddress" title="Adres" :validator="validator" :required="true" />
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, Dropdown, EmailInput, PhoneInput, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { Address } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';

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

    editAddress = Address.create(this.address)
    validator = new Validator()

    MemberManager = MemberManager


    modifyAddress({ from, to }: { from: Address, to: Address }) {
        MemberManager.updateAddress(from, to)
    }

    async save() {
        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }

        MemberManager.updateAddress(this.address, this.editAddress)
        this.dismiss({force: true})
    }
}
</script>