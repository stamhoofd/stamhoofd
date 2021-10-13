<template>
    <div id="member-general-view">
        <STErrorsDefault :error-box="errorBox" />
        <div class="split-inputs">
            <div>
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

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" title="Geboortedatum" :validator="validator" :required="false" />

                <STInputBox v-if="isPropertyEnabled('gender')" title="Identificeert zich als..." error-fields="gender" :error-box="errorBox">
                    <RadioGroup>
                        <Radio v-model="gender" value="Male" autocomplete="sex" name="sex">
                            Man
                        </Radio>
                        <Radio v-model="gender" value="Female" autocomplete="sex" name="sex">
                            Vrouw
                        </Radio>
                        <Radio v-model="gender" value="Other" autocomplete="sex" name="sex">
                            Andere
                        </Radio>
                    </RadioGroup>
                </STInputBox>
            </div>

            <div>
                <AddressInput v-if="isPropertyEnabled('address') || address" v-model="address" title="Adres van dit lid" :validator="validator" :required="false" />
                <EmailInput v-if="isPropertyEnabled('emailAddress') || email" v-model="email" title="E-mailadres van dit lid" placeholder="Enkel van lid zelf" :required="false" :validator="validator" />
                <PhoneInput v-if="isPropertyEnabled('phone') || phone" v-model="phone" title="GSM-nummer van dit lid" :validator="validator" :required="false" placeholder="Enkel van lid zelf" />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components"
import { Address, Gender, Version } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';

@Component({
    components: {
        Slider,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        BirthDayInput,
        RadioGroup,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        LoadingButton
    },
    model: {
        prop: 'details',
        event: 'change'
    },
})
export default class EditMemberGeneralView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    details!: MemberDetails

    errorBox: ErrorBox | null = null

    @Prop({ required: true })
    validator: Validator

    isPropertyEnabled(name: "emailAddress" | "birthDay" | "phone" | "address") {
        return OrganizationManager.organization.meta.recordsConfiguration[name]?.enabledWhen?.doesMatch(this.details) ?? false
    }

    isPropertyRequired(name: "emailAddress" | "birthDay" | "phone" | "address") {
        return this.isPropertyEnabled(name) && (OrganizationManager.organization.meta.recordsConfiguration[name]?.requiredWhen?.doesMatch(this.details) ?? false)
    }

    mounted() {
        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid()
            })
        }
    }

    get age() {
        return this.details.age ?? 99
    }

    // Convenience Mappers
    get firstName() {
        return this.details.firstName
    }

    set firstName(firstName: string) {
        this.details.firstName = firstName
    }

    get lastName() {
        return this.details.lastName
    }

    set lastName(lastName: string) {
        this.details.lastName = lastName
    }

    get phone() {
        return this.details.phone
    }

    set phone(phone: string | null) {
        this.details.phone = phone
    }

    get address() {
        return this.details.address
    }

    set address(address: Address | null) {
        this.details.address = address
    }

    get email() {
        return this.details.email
    }

    set email(email: string | null) {
        this.details.email = email
    }

    get birthDay() {
        return this.details.birthDay
    }

    set birthDay(birthDay: Date | null) {
        this.details.birthDay = birthDay
    }

    get gender() {
        return this.details.gender
    }

    set gender(gender: Gender) {
        this.details.gender = gender
    }

    isValid() {
        const errors = new SimpleErrors()
        if (this.firstName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de voornaam in",
                field: "firstName"
            }))
        }

        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        return valid
    }
}
</script>
