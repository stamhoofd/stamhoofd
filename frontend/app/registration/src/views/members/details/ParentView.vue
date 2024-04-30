<template>
    <SaveView :save-text="!parent ? 'Toevoegen' : 'Opslaan'" title="Ouder" :loading="loading" @save="goNext">
        <h1 v-if="!parent">
            Ouder toevoegen
        </h1>
        <h1 v-else>
            Gegevens van {{ parent.firstName }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />
        <div class="split-inputs">
            <div>
                <STInputBox title="Titel" error-fields="type" :error-box="errorBox">
                    <Dropdown v-model="type">
                        <option v-for="type in parentTypes" :key="type" :value="type">
                            {{ parentTypeName(type) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="validator" :placeholder="$t('registration.inputs.parentPhone.placeholder')" />
                <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="Voor belangrijke mededelingen" autocomplete="email" />
                <p v-if="hasAccess" class="style-description-small">
                    Deze ouder kan met het bovenstaande e-mailadres inloggen om toegang te krijgen tot het ledenportaal.
                </p>
            </div>
                
            <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="validator" @modify="modifyAddress" />
        </div>
    </SaveView>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Dropdown, EmailInput, ErrorBox, PhoneInput, STErrorsDefault, STInputBox, SaveView, SelectionAddressInput, Validator } from "@stamhoofd/components";
import { Address, MemberDetails, Parent, ParentType, ParentTypeHelper } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STInputBox,
        PhoneInput,
        EmailInput,
        SelectionAddressInput,
        Dropdown
    }
})
export default class ParentView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
        memberDetails: MemberDetails | null

    @Prop({ default: null })
        parent: Parent | null

    @Prop({ required: true })
        handler: (parent: Parent, component: ParentView) => Promise<void>|undefined;

    loading = false

    firstName = ""
    lastName = ""
    type: ParentType = ParentType.Mother
    phone: string | null = null
    email: string | null = null
    errorBox: ErrorBox | null = null

    address: Address | null = null

    validator = new Validator()

    

    get hasAccess() {
        return this.memberDetails?.parentsHaveAccess ?? false
    }

    mounted() {
        if (this.parent) {
            this.firstName = this.parent.firstName
            this.lastName = this.parent.lastName
            this.phone = this.parent.phone
            this.email = this.parent.email
            this.address = this.parent.address ? Address.create(this.parent.address) : null
            this.type = this.parent.type
        }
    }

    get parentTypes() {
        return ParentTypeHelper.getPublicTypes()
    }

    parentTypeName(type: ParentType) {
        return ParentTypeHelper.getName(type)
    }

    get availableAddresses() {
        const addresses = this.$memberManager.getAddresses()
        if (this.memberDetails) {
            for (const parent of this.memberDetails.parents) {
                if (parent.address && !addresses.find(a => a.toString() == parent.address!.toString())) {
                    addresses.push(parent.address)
                }
            }
        }
        return addresses
    }

    modifyAddress({ from, to }: { from: Address, to: Address }) {
        this.$memberManager.updateAddress(from, to)
        if (this.memberDetails) {
            this.memberDetails.updateAddress(from, to)
        }
    }

    async goNext() {
        if (this.loading) {
            return;
        }

        const errors = new SimpleErrors()
        if (this.firstName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de voornaam in",
                field: "firstName"
            }))
        }
        if (this.lastName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de achternaam in",
                field: "lastName"
            }))
        }

        this.loading = true
        try {
            const valid = await this.validator.validate()

            if (errors.errors.length > 0) {
                this.loading = false
                this.errorBox = new ErrorBox(errors)
                return;
            } 

            if (!valid) {
                this.loading = false
                this.errorBox = null
                return;
            }

        } catch (e) {
            this.loading = false
            this.errorBox = new ErrorBox(e)
            return;
        }
       
        if (this.parent) {
            this.parent.firstName = this.firstName
            this.parent.lastName = this.lastName
            this.parent.phone = this.phone
            this.parent.email = this.email
            this.parent.address = this.address
            this.parent.type = this.type
            this.$memberManager.updateParent(this.parent)
            if (this.memberDetails) {
                this.memberDetails.updateParent(this.parent)
            }
        } else {
            this.parent = Parent.create({
                firstName: this.firstName,
                lastName: this.lastName,
                phone: this.phone,
                email: this.email,
                address: this.address,
                type: this.type
            })
        }
        
        try {
            await this.handler(this.parent, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>