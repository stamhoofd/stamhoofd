<template>
    <form id="member-general-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Inschrijven">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1 v-if="isNew">
                Wie ga je inschrijven?
            </h1>
            <h1 v-else-if="details.isRecovered">
                Gegevens aanvullen van {{ details.firstName }}
            </h1>
            <h1 v-else>
                Gegevens nakijken van {{ details.firstName }}
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

                    <BirthDayInput v-model="birthDay" title="Geboortedatum" :validator="validator" />

                    <STInputBox title="Identificeert zich als..." error-fields="gender" :error-box="errorBox">
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

                    <Checkbox v-if="livesAtParents || (age >= 18 && age <= 27)" v-model="livesAtParents">
                        Woont bij ouders
                    </Checkbox>
                </div>

                <div>
                    <AddressInput v-if="age >= 18 && !livesAtParents" v-model="address" title="Adres van dit lid" :validator="validator" />
                    <EmailInput v-if="age >= 11 || email" v-model="email" title="E-mailadres van dit lid" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :required="age >= 18" :validator="validator" />
                    <PhoneInput v-if="age >= 11 || phone" v-model="phone" title="GSM-nummer van dit lid" :validator="validator" :required="age >= 18" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />
                </div>
            </div>
        </main>

        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary">
                    Volgende
                </button>
            </LoadingButton>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton,BirthDayInput, CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Address, Gender, Version } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
        EmailInput,
        Checkbox,
        LoadingButton,
        BackButton
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

    livesAtParents = this.details.parents.length > 0
    validator = new Validator()
    errorBox: ErrorBox | null = null

    get age() {
        return this.details.age ?? 99
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
            
            if (valid && !this.birthDay) {
                // Security check in case event based validation fails
                // no translations needed here, since this is an edge case
                errors.addError(new SimpleError({
                    code: "invalid_field",
                    message: "Birthday check failed",
                }))
            }

            if (this.age <= 18 || this.livesAtParents) {
                // remove address
                this.address = null
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
