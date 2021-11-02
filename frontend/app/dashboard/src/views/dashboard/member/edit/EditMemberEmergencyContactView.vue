<template>
    <div class="st-view">
        <STNavigationBar title="Noodcontact">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon gray close" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                Gegevens van een noodcontactpersoon
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                        <input v-model="name" class="input" nmae="name" type="text" placeholder="Naam" autocomplete="name">
                    </STInputBox>

                    <STInputBox title="Relatie*" error-fields="title" :error-box="errorBox">
                        <input v-model="title" list="emergency-contact-types" class="input" name="type" type="text" placeholder="Bv. buurman">
                        <datalist id="emergency-contact-types">
                            <option v-if="details && details.parents.length == 0" value="Vader" />
                            <option v-if="details && details.parents.length == 0" value="Moeder" />
                            <option v-if="details && details.parents.length == 0" value="Ouder" />
                            <option v-if="details && details.defaultAge < 30" value="Oma" />
                            <option v-if="details && details.defaultAge < 30" value="Opa" />
                            <option v-if="details && details.defaultAge < 30" value="Tante" />
                            <option v-if="details && details.defaultAge < 30" value="Oom" />
                            <option value="Buurvrouw" />
                            <option value="Buurman" />
                            <option value="Vriend" />
                            <option v-if="details && details.defaultAge < 30" value="Nonkel" />
                            <option v-if="details && details.defaultAge < 30" value="Pepe" />
                            <option v-if="details && details.defaultAge < 30" value="Meme" />
                            <option v-if="details && details.defaultAge < 30" value="Grootvader" />
                            <option v-if="details && details.defaultAge < 30" value="Grootmoeder" />
                        </datalist>
                    </STInputBox>
                    <p class="style-description-small">
                        *Vul gelijk welke benaming in met het toetsenbord of kies één uit de lijst.
                    </p>
                </div>

                <div>
                    <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label')" :validator="validator" :placeholder="$t('shared.inputs.mobile.label')" :required="false" />
                </div>
            </div>
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="goNext">
                {{ !contact ? 'Toevoegen' : 'Opslaan' }}
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton,Checkbox, EmailInput, ErrorBox, PhoneInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { EmergencyContact, MemberDetails } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../../classes/FamilyManager';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        Radio,
        PhoneInput,
        EmailInput,
        Checkbox,
        STList,
        STListItem,
        BackButton
    }
})
export default class EditMemberEmergencyContactView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    details: MemberDetails | null // tood

    @Prop({ default: null })
    contact: EmergencyContact | null // tood

    @Prop({ required: true })
    familyManager: FamilyManager

    @Prop({ required: true })
    handler: (contact: EmergencyContact, component: EditMemberEmergencyContactView) => void;

    name = ""
    title = ""
    phone: string | null = null

    errorBox: ErrorBox | null = null
    validator = new Validator()

    mounted() {
        if (this.contact) {
            this.name = this.contact.name
            this.title = this.contact.title
            this.phone = this.contact.phone
        } else {
            const contact = this.familyManager.getEmergencyContact()
            if (contact) {
                this.name = contact.name
                this.title = contact.title
                this.phone = contact.phone
            }
        }
    }

    async goNext() {
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

        const valid = await this.validator.validate()

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
            return;
        } 
        
        if (!valid) {
            this.errorBox = null
            return;
        }

        if (this.contact) {
            this.contact.name = this.name
            this.contact.title = this.title
            this.contact.phone = this.phone && this.phone.length > 0 ? this.phone : null
            this.handler(this.contact, this)
        } else {
            const contact = EmergencyContact.create({
                name: this.name,
                phone: this.phone,
                title: this.title
            })
            this.handler(contact, this)
        }
    }
}
</script>