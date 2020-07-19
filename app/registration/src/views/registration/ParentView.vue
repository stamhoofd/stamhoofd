<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Ouder">
            <button slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        
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
                        <select class="input" v-model="type">
                            <option v-for="type in parentTypes" :key="type" :value="type">{{ parentTypeName(type) }}</option>
                        </select>
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

                    <PhoneInput title="GSM-nummer" v-model="phone" :validator="validator" placeholder="GSM-nummer van ouder" />

                </div>

                <div>
                    <STInputBox v-if="availableAddresses.length > 0" title="Kies een adres">
                        <STList>
                            <STListItem v-for="_address in availableAddresses" :key="_address.toString()" element-name="label" :selectable="true" class="left-center address-selection">
                                <Radio v-model="address" slot="left" :value="_address"/>
                                {{ _address.street }} {{ _address.number }}<br>
                                {{ _address.postalCode }} {{ _address.city }}
                                <button slot="right" class="button icon gray edit" @click.stop="doEditAddress(_address)"/>
                            </STListItem>
                            <STListItem element-name="label" :selectable="true" class="left-center">
                                <Radio v-model="address" slot="left" :value="customAddress"/>
                                Een ander adres ingeven
                            </STListItem>
                        </STList>
                    </STInputBox>
                    <AddressInput :title="address === customAddress ? 'Nieuw adres' : 'Adres bewerken'" v-if="editingAddress || address === customAddress" v-model="editAddress" :validator="validator"/>
                </div>
            </div>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="goNext">
                {{ !parent ? 'Toevoegen' : 'Opslaan' }}
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, AddressInput, Radio, PhoneInput, Checkbox, Validator, STList, STListItem } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent, ParentType, ParentTypeHelper } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';
import { MemberManager } from '../../classes/MemberManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        Radio,
        PhoneInput,
        Checkbox,
        STList,
        STListItem
    }
})
export default class ParentView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    memberDetails: MemberDetails | null

    @Prop({ default: null })
    parent: Parent | null

    @Prop({ required: true })
    handler: (parent: Parent, component: ParentView) => void;

    firstName = ""
    lastName = ""
    type: ParentType = ParentType.Mother
    phone: string | null = null
    email: string | null = null
    errorBox: ErrorBox | null = null

    address: Address | null = null
    customAddress: Address | null = null
    editingAddress = false

    validator = new Validator()

    MemberManager = MemberManager

    mounted() {
        if (this.parent) {
            this.firstName = this.parent.firstName
            this.lastName = this.parent.lastName
            this.phone = this.parent.phone
            this.email = this.parent.email
            this.address = this.parent.address ? Address.create(this.parent.address) : null
            this.type = this.parent.type
        } else {
            if (this.availableAddresses.length > 0) {
                this.address = this.availableAddresses[0]
            }
        }
    }

    get parentTypes() {
        return Object.values(ParentType)
    }

    parentTypeName(type: ParentType) {
        return ParentTypeHelper.getName(type)
    }

    get availableAddresses() {
        const addresses = MemberManager.getAddresses()
        if (this.memberDetails) {
            for (const parent of this.memberDetails.parents) {
                if (parent.address && !addresses.find(a => a.toString() == parent.address!.toString())) {
                    addresses.push(parent.address)
                }
            }
        }
        return addresses
    }

    get editAddress() {
        return this.address
    }

    set editAddress(address: Address | null) {
        if (this.address && address) {
            MemberManager.updateAddress(this.address, address)
            if (this.memberDetails) {
                this.memberDetails.updateAddress(this.address, address)
            }
        } else {
            if (this.address === this.customAddress) {
                this.customAddress = address
            }
        }
        this.address = address
    }

    doEditAddress(address: Address) {
        this.$set(this, "address", address)
        this.editingAddress = true
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

        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (valid) {
            if (this.parent) {
                this.parent.firstName = this.firstName
                this.parent.lastName = this.lastName
                this.parent.phone = this.phone
                this.parent.email = this.email
                this.parent.address = this.address
                this.parent.type = this.type
                MemberManager.updateParent(this.parent)
                if (this.memberDetails) {
                    this.memberDetails.updateParent(this.parent)
                }
            } else {
                this.parent = Parent.create({
                    firstName: this.firstName,
                    lastName: this.lastName,
                    phone: this.phone,
                    email: null,
                    address: this.address,
                    type: this.type
                })
            }
            
            this.handler(this.parent, this)
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables" as *;
@use "@stamhoofd/scss/base/text-styles" as *;

#parent-view {
    .address-selection {
        .middle {
            @extend .style-normal;
        }
    }
}
</style>
