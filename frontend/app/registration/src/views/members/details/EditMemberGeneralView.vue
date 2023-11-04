<template>
    <SaveView :loading="loading" save-text="Volgende" title="Inschrijven" @save="goNext">
        <h1 v-if="isNew">
            Nieuw lid toevoegen
        </h1>
        <h1 v-else>
            Gegevens nakijken van {{ details.firstName }}
        </h1>
            
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

                <BirthDayInput v-if="isPropertyEnabled('birthDay') || birthDay" v-model="birthDay" :title="isPropertyRequired('birthDay') ? 'Geboortedatum' : 'Geboortedatum (optioneel)'" :validator="validator" :required="isPropertyRequired('birthDay')" />

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
                <AddressInput v-if="isPropertyEnabled('address') || address" v-model="address" :required="isPropertyRequired('address')" :title="'Adres' + lidSuffix + (isPropertyRequired('address') ? '' : '(optioneel)')" :validator="validator" />
                <EmailInput v-if="isPropertyEnabled('emailAddress') || email" v-model="email" :required="isPropertyRequired('emailAddress')" :title="'E-mailadres' + lidSuffix " :placeholder="isPropertyRequired('emailAddress') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :validator="validator" />
                <PhoneInput v-if="isPropertyEnabled('phone') || phone" v-model="phone" :title="$t('shared.inputs.mobile.label') + lidSuffix " :validator="validator" :required="isPropertyRequired('phone')" :placeholder="isPropertyRequired('phone') ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />
            </div>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, CenteredMessage, EmailInput, ErrorBox, PhoneInput, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, Gender, MemberDetails, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        BirthDayInput,
        RadioGroup,
        Radio,
        PhoneInput,
        EmailInput
    }
})
export default class EditMemberGeneralView extends Mixins(NavigationMixin) {
    loading = false
    didAutofillEmail = false

    @Prop({ required: true })
        isNew: boolean

    @Prop({ required: true })
        details!: MemberDetails

    @Prop({ required: true })
        saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    validator = new Validator()
    errorBox: ErrorBox | null = null

    get age() {
        return this.details.age ?? 99
    }

    get lidSuffix() {
        if (this.firstName.length < 2) {
            if (this.age < 18) {
                return " van dit lid"
            }
            return ""
        }
        if (this.age < 18) {
            return " van "+this.firstName
        }
        return ""
    }

    isPropertyEnabled(name: "emailAddress" | "birthDay" | "phone" | "address"|"gender") {
        return OrganizationManager.organization.meta.recordsConfiguration[name]?.enabledWhen?.decode(
            MemberDetails.getBaseFilterDefinitions()
        ).doesMatch(this.details) ?? false
    }

    isPropertyRequired(name: "emailAddress" | "birthDay" | "phone" | "address") {
        return this.isPropertyEnabled(name) && (OrganizationManager.organization.meta.recordsConfiguration[name]?.requiredWhen?.decode(
            MemberDetails.getBaseFilterDefinitions()
        ).doesMatch(this.details) ?? false)
    }

    async goNext() {
        if (this.loading) {
            return;
        }

        this.loading = true
        this.errorBox = null

        try {
            let valid = await this.validator.validate()
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
            
            if (valid && !this.birthDay && this.isPropertyRequired("birthDay")) {
                // Security check in case event based validation fails
                // no translations needed here, since this is an edge case
                errors.addError(new SimpleError({
                    code: "invalid_field",
                    message: "Birthday check failed",
                }))
            }

            errors.throwIfNotEmpty()

            if (!valid) {
                this.loading = false
                return
            }

            this.details.reviewTimes.markReviewed("details")
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    @Prop({ required: true })
        originalDetails: MemberDetails

    async shouldNavigateAway() {
        if (
            JSON.stringify(this.details.encode({ version: Version })) == JSON.stringify(this.originalDetails.encode({ version: Version }))
        ) {
            // Nothing changed
            return true
        }
        if (await CenteredMessage.confirm("Ben je zeker dat je dit venster wilt sluiten zonder op te slaan?", "Sluiten")) {
            return true;
        }
        return false;
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
        if (email !== this.email) {
            if (this.didAutofillEmail) {
                this.didAutofillEmail = false
            }
        }
        this.details.email = email
    }

    get birthDay() {
        return this.details.birthDay
    }

    set birthDay(birthDay: Date | null) {
        this.details.birthDay = birthDay

        if (this.details.age && this.details.age >= 18) {
            if (!this.email) {
                // Recommend the current user's email
                this.email = SessionManager.currentSession?.user?.email ?? null
                this.didAutofillEmail = this.email !== null
            }
            
        } else {
            if (this.email && this.didAutofillEmail) {
                this.email = ""
                this.didAutofillEmail = false
            }
        }
    }

    get gender() {
        return this.details.gender
    }

    set gender(gender: Gender) {
        this.details.gender = gender
    }
}
</script>
