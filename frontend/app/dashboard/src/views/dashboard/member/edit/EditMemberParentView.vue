<template>
    <div class="st-view">
        <STNavigationBar title="Ouder" />
        
        <main>
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

                    <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="validator" :placeholder="$t('dashboard.inputs.parentPhone.placeholder')" :required="false" />
                    <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="E-mailadres van ouder" :required="false" />
                </div>

                <SelectionAddressInput v-model="address" :addresses="availableAddresses" :validator="validator" :required="false" @modify="modifyAddress" />
            </div>
        </main>

        <STToolbar>
            <template #right><LoadingButton :loading="loading">
                <button class="button primary" @click="goNext">
                    {{ !parent ? 'Toevoegen' : 'Opslaan' }}
                </button>
            </LoadingButton></template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Dropdown,EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, SelectionAddressInput, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { Address, MemberDetails, Parent, ParentType, ParentTypeHelper } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import { FamilyManager } from '../../../../classes/FamilyManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        SelectionAddressInput,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        STList,
        STListItem,
        BackButton,
        LoadingButton,
        Dropdown
    }
})
export default class EditMemberParentView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    memberDetails: MemberDetails | null

    @Prop({ default: null })
    parent: Parent | null

    @Prop({ required: true })
    familyManager: FamilyManager

    @Prop({ required: true })
    handler: (parent: Parent, component: EditMemberParentView) => void;

    firstName = ""
    lastName = ""
    type: ParentType = ParentType.Mother
    phone: string | null = null
    email: string | null = null
    errorBox: ErrorBox | null = null

    address: Address | null = null
    customAddress: Address | null = null
    editingAddress: Address | null = null

    loading = false

    validator = new Validator()

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
        return Object.values(ParentType)
    }

    parentTypeName(type: ParentType) {
        return ParentTypeHelper.getName(type)
    }

    get availableAddresses() {
        const addresses = this.familyManager.getAddresses()
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
        this.familyManager.updateAddress(from, to)
        if (this.memberDetails) {
            this.memberDetails.updateAddress(from, to)
        }
    }

    async goNext() {
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

        const valid = await this.validator.validate()

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
            return;
        } 
        
        if (!valid) {
            this.errorBox = null
            return;
        }

        if (this.parent) {
            this.parent.firstName = this.firstName
            this.parent.lastName = this.lastName
            this.parent.phone = this.phone
            this.parent.email = this.email
            this.parent.address = this.address
            this.parent.type = this.type
            this.familyManager.updateParent(this.parent)
            if (this.memberDetails) {
                this.memberDetails.updateParent(this.parent)
            }
            this.handler(this.parent, this)
        } else {
            const parent = Parent.create({
                firstName: this.firstName,
                lastName: this.lastName,
                phone: this.phone,
                email: this.email,
                address: this.address,
                type: this.type
            })
            this.handler(parent, this)
        }
        
    }
}
</script>