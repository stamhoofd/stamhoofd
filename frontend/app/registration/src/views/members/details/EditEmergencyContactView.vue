<template>
    <div id="emergency-contact-view" class="st-view">
        <STNavigationBar title="Noodcontact">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1 v-if="details.parents.length > 0">
                Gegevens van een reserve noodcontactpersoon
            </h1>
            <h1 v-else>
                Gegevens van een noodcontactpersoon
            </h1>
            <p v-if="details.parents.length > 0">
                Ouders worden altijd als eerste gecontacteerd in nood, maar graag hebben we nog een extra contact voor als ouders niet bereikbaar zijn. Dit kan bv. een tante, opa of buurvrouw zijn.
            </p>
            <p v-else>
                Graag hebben we een contactpersoon voor in noodgevallen. Dit kan een ouder, tante, opa, buurvrouw of gelijk wie je verkiest zijn.
            </p>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                        <input v-model="name" class="input" nmae="name" type="text" placeholder="Naam" autocomplete="name">
                    </STInputBox>

                    <STInputBox title="Relatie*" error-fields="title" :error-box="errorBox">
                        <input v-model="title" list="emergency-contact-types" class="input" name="type" type="text" placeholder="Bv. oma">
                        <datalist id="emergency-contact-types">
                            <option v-if="details.parents.length == 0" value="Vader" />
                            <option v-if="details.parents.length == 0" value="Moeder" />
                            <option v-if="details.parents.length == 0" value="Ouder" />
                            <option value="Oma" />
                            <option value="Opa" />
                            <option value="Tante" />
                            <option value="Oom" />
                            <option value="Buurvrouw" />
                            <option value="Buurman" />
                            <option value="Nonkel" />
                            <option value="Pepe" />
                            <option value="Meme" />
                            <option value="Grootvader" />
                            <option value="Grootmoeder" />
                        </datalist>
                    </STInputBox>
                    <p class="style-description-small">
                        *Vul gelijk welke benaming in met het toetsenbord of kies één uit de lijst.
                    </p>
                </div>

                <div>
                    <PhoneInput v-model="phone" title="GSM-nummer" :validator="validator" placeholder="GSM-nummer" />
                </div>
            </div>
        </main>

        <STToolbar>
            <button v-if="isOptional" slot="right" class="button secundary" @click="skipStep">
                <template v-if="details.emergencyContacts.length == 0">
                    Overslaan
                </template>
                <template v-else>
                    Verwijderen
                </template>
            </button>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="goNext">
                    Volgende
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, BirthDayInput, Checkbox, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { AskRequirement,EmergencyContact, MemberDetails } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

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
        Checkbox,
        BackButton,
        LoadingButton
    }
})
export default class EditEmergencyContactView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    isNew: boolean

    @Prop({ required: true })
    details: MemberDetails

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    name = ""
    title = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null

    validator = new Validator()

    mounted() {
        if (this.details.emergencyContacts.length > 0) {
            const contact = this.details.emergencyContacts[0]
            this.name = contact.name
            this.title = contact.title
            this.phone = contact.phone
        } else {
            const contact = MemberManager.getEmergencyContact()
            if (contact) {
                this.name = contact.name
                this.title = contact.title
                this.phone = contact.phone
            }
        }
    }

    get isOptional() {
        return OrganizationManager.organization.meta.recordsConfiguration.emergencyContact !== AskRequirement.Required
    }

    async skipStep() {
        if (this.loading) {
            return;
        }
        this.details.emergencyContacts = []
        this.errorBox = null;
        this.loading = true

        try {
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async goNext() {
        if (this.loading) {
            return;
        }

        const errors = new SimpleErrors()
        if (this.name.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de naam in",
                field: "name"
            }))
        }

        if (this.title.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de relatie in",
                field: "title"
            }))
        }

        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }

        this.loading = true
        valid = valid && await this.validator.validate()

        if (valid) {
            this.details.emergencyContacts = [
                    EmergencyContact.create({
                    name: this.name,
                    phone: this.phone,
                    title: this.title
                })
            ]

            try {
                this.details.reviewTimes.markReviewed("emergencyContacts")
                await this.saveHandler(this.details, this)
            } catch (e) {
                this.errorBox = new ErrorBox(e)
            }
            this.loading = false

        } else {
            this.loading = false
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#emergency-contact-view {
}
</style>
