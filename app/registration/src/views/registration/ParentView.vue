<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar title="Ouder">
            <button slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        
        <main>
            <h1>
                Gegevens van een ouder
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van het lid" error-fields="firstName,lastName" :error-box="errorBox">
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
                    <AddressInput title="Adres" v-model="address" :validator="validator"/>

                    <p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p><p>Dit is een test</p>



                </div>
            </div>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="goNext">
                Toevoegen
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BirthDayInput, AddressInput, RadioGroup, Radio, PhoneInput, Checkbox, Validator } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails, Parent } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import MemberParentsView from './MemberParentsView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        BirthDayInput,
        RadioGroup,
        Radio,
        PhoneInput,
        Checkbox
    }
})
export default class ParentView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    parent: Parent | null // tood

    @Prop({ required: true })
    handler: (parent: Parent) => void;

    firstName = ""
    lastName = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null

    address: Address | null = null
    validator = new Validator()

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
            const parent = Parent.create({
                firstName: this.firstName,
                lastName: this.lastName,
                phone: this.phone,
                mail: null,
                address: this.address
            })

            // todo: Get possible groups

           this.handler(parent)
           this.pop()
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#parent-view {
}
</style>
