<template>
    <SaveView title="Noodcontact" :loading="loading" :save-text="saveText" @save="goNext">
        <h1 v-if="details.parents.length > 0">
            Reserve noodcontactpersoon
        </h1>
        <h1 v-else>
            Noodcontactpersoon
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
                        <option v-if="details.parents.length == 0 && details.defaultAge >= 18" value="Partner" />
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
                <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="validator" :placeholder="$t('shared.inputs.mobile.label')" />
            </div>
        </div>

        <hr v-if="isOptional && details.emergencyContacts.length > 0">
        <button v-if="isOptional && details.emergencyContacts.length > 0" class="button text" type="button" @click="skipStep">
            <span class="icon trash" />
            <span>Noodcontact verwijderen</span>
        </button>
    </SaveView>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, CenteredMessage, ErrorBox, PhoneInput, STErrorsDefault, STInputBox, SaveView, Validator } from "@stamhoofd/components";
import { EmergencyContact, FilterDefinition, MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RegisterItem, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";



@Component({
    components: {
        SaveView,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        PhoneInput,
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

    getFilterDefinitionsForProperty(property: string): FilterDefinition[] {
        if (['parents', 'emergencyContacts'].includes(property)) {
            return MemberDetailsWithGroups.getBaseFilterDefinitions()
        }
        return MemberDetails.getBaseFilterDefinitions()
    }

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

    get isAllEmpty() {
        return this.name == "" && this.title == "" && (this.phone == null || this.phone.length == 0)
    }

    get saveText() {
        if (this.isOptional && this.isAllEmpty) {
            return "Sla over"
        }
        return this.nextText
    }

    mounted() {
        if (this.details.emergencyContacts.length > 0) {
            const contact = this.details.emergencyContacts[0]
            this.name = contact.name
            this.title = contact.title
            this.phone = contact.phone
        } else {
            const contact = this.$memberManager.getEmergencyContact()
            if (contact) {
                this.name = contact.name
                this.title = contact.title
                this.phone = contact.phone
            }
        }
    }

    get isOptional() {
        return !this.$organization.meta.recordsConfiguration.emergencyContacts?.requiredWhen?.decode(this.getFilterDefinitionsForProperty('emergencyContacts')).doesMatch(new MemberDetailsWithGroups(this.details, this.member, this.items))
        //return this.$organization.meta.recordsConfiguration.emergencyContact !== AskRequirement.Required
    }

    async skipStep() {
        if (this.loading) {
            return;
        }
        if (!await CenteredMessage.confirm(this.details.emergencyContacts.length > 0 ? "Ben je zeker dat je deze noodcontact wilt verwijderen en deze stap wilt overslaan?" : "Ben je zeker dat je deze stap wilt overslaan?", "Overslaan")) {
            return;
        }

        this.name = ""
        this.title = ""
        this.phone = null
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

        if (this.isAllEmpty && this.isOptional) {
            return await this.skipStep()
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