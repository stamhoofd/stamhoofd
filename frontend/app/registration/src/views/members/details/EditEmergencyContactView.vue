<template>
    <div id="emergency-contact-view" class="st-view">
        <STNavigationBar title="Noodcontact">
            <BackButton v-if="canPop" slot="left" @click="pop" />

            <button v-if="isOptional && details.emergencyContacts.length > 0" slot="right" class="button text only-icon-smartphone" type="button" @click="skipStep">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1 v-if="details.parents.length > 0">
                Gegevens van een reserve noodcontactpersoon
            </h1>
            <h1 v-else>
                Gegevens van een noodcontactpersoon
            </h1>
            <p v-if="details.parents.length > 0">
                Ouders worden altijd als eerste gecontacteerd in nood, maar graag hebben we nog een extra contact voor als ouders niet bereikbaar zijn.

                <template v-if="details.defaultAge > 40">
                    Dit kan bijvoorbeeld een kind, vriend, ouder, buurvrouw of gelijk wie zijn die je vertrouwt. 
                </template>
                <template v-else>
                    Dit kan een vriend, buurvrouw of gelijk wie zijn die je vertrouwt. 
                </template>
            </p>
            <p v-else>
                <template v-if="details.defaultAge > 40">
                    Graag hebben we een contactpersoon voor in noodgevallen. Dit kan bijvoorbeeld een kind, vriend, ouder, buurvrouw of gelijk wie zijn die je vertrouwt. 
                </template>
                <template v-else>
                    Graag hebben we een contactpersoon voor in noodgevallen. Dit kan een ouder, vriend, buurvrouw of gelijk wie zijn die je vertrouwt. 
                </template>
            </p>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                        <input v-model="name" class="input" nmae="name" type="text" placeholder="Naam" autocomplete="name">
                    </STInputBox>

                    <STInputBox title="Relatie*" error-fields="title" :error-box="errorBox">
                        <input v-model="title" list="emergency-contact-types" class="input" name="type" type="text" placeholder="Bv. buurman">
                        <datalist id="emergency-contact-types">
                            <option v-if="details.parents.length == 0" value="Vader" />
                            <option v-if="details.parents.length == 0" value="Moeder" />
                            <option v-if="details.parents.length == 0" value="Ouder" />
                            <option v-if="details.defaultAge < 30" value="Oma" />
                            <option v-if="details.defaultAge < 30" value="Opa" />
                            <option v-if="details.defaultAge < 30" value="Tante" />
                            <option v-if="details.defaultAge < 30" value="Oom" />
                            <option value="Buurvrouw" />
                            <option value="Buurman" />
                            <option value="Vriend" />
                            <option v-if="details.defaultAge < 30" value="Nonkel" />
                            <option v-if="details.defaultAge < 30" value="Pepe" />
                            <option v-if="details.defaultAge < 30" value="Meme" />
                            <option v-if="details.defaultAge < 30" value="Grootvader" />
                            <option v-if="details.defaultAge < 30" value="Grootmoeder" />
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
            <button v-if="isOptional && details.emergencyContacts.length == 0" slot="right" class="button secundary" @click="skipStep">
                Overslaan
            </button>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="goNext">
                    {{ nextText }}
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, BirthDayInput, CenteredMessage, Checkbox, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { MemberWithRegistrations, RegisterItem } from '@stamhoofd/structures';
import { AskRequirement,EmergencyContact, MemberDetails, MemberDetailsWithGroups, Version } from "@stamhoofd/structures"
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
    nextText: string

    @Prop({ required: true })
    details: MemberDetails

    @Prop({ required: false })
    member?: MemberWithRegistrations

    @Prop({ required: true })
    items: RegisterItem[]

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    name = ""
    title = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null

    validator = new Validator()

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
        return !OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts?.requiredWhen?.doesMatch(new MemberDetailsWithGroups(this.details, this.member, this.items))
        //return OrganizationManager.organization.meta.recordsConfiguration.emergencyContact !== AskRequirement.Required
    }

    async skipStep() {
        if (this.loading) {
            return;
        }
        this.details.emergencyContacts = []
        this.errorBox = null;
        this.loading = true

        try {
            this.details.reviewTimes.markReviewed("emergencyContacts")
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