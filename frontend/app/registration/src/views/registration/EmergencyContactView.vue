<template>
    <div id="emergency-contact-view" class="st-view">
        <STNavigationBar title="Noodcontact">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                Gegevens van een reserve noodcontactpersoon
            </h1>
            <p>Ouders worden altijd als eerste gecontacteerd in nood, maar graag hebben we nog een extra contact voor als ouders niet bereikbaar zijn. Dit kan bv. een tante, opa of buurvrouw zijn.</p>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                        <input v-model="name" class="input" nmae="name" type="text" placeholder="Naam" autocomplete="name">
                    </STInputBox>

                    <STInputBox title="Relatie*" error-fields="title" :error-box="errorBox">
                        <input v-model="title" list="emergency-contact-types" class="input" name="type" type="text" placeholder="Bv. oma">
                        <datalist id="emergency-contact-types">
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
                Overslaan
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
import { AskRequirement,EmergencyContact } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import { MemberManager } from '../../classes/MemberManager';

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
export default class EmergencyContactView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    contact: EmergencyContact | null // tood

    @Prop({ required: true })
    handler: (contact: EmergencyContact | null, component: EmergencyContactView) => Promise<void>;

    name = ""
    title = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null
    loading = false

    validator = new Validator()

    mounted() {
        if (this.contact) {
            this.name = this.contact.name
            this.title = this.contact.title
            this.phone = this.contact.phone
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

    skipStep() {
        this.handler(null, this)
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
            if (this.contact) {
                this.contact.name = this.name
                this.contact.title = this.title
                this.contact.phone = this.phone
            } else {
                this.contact = EmergencyContact.create({
                    name: this.name,
                    phone: this.phone,
                    title: this.title
                })
            }

            try {
                await this.handler(this.contact, this)
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
