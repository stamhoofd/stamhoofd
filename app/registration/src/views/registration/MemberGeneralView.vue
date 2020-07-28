<template>
    <form id="member-general-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Inschrijven">
            <button slot="right" class="button icon gray close" @click="pop" type="button"></button>
        </STNavigationBar>
        
        <main>
            <h1 v-if="!member">
                Wie ga je inschrijven?
            </h1>
            <h1 v-else>
                Gegevens wijzigen van {{ member.details.firstName }}
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

                    <BirthDayInput title="Geboortedatum" :validator="validator" v-model="birthDay" />

                    <STInputBox title="Identificeert zich als..." error-fields="gender" :error-box="errorBox">
                        <RadioGroup>
                            <Radio v-model="gender" value="Male" autocomplete="sex" name="sex">Man</Radio>
                            <Radio v-model="gender" value="Female" autocomplete="sex" name="sex">Vrouw</Radio>
                            <Radio v-model="gender" value="Other" autocomplete="sex" name="sex">Andere</Radio>
                        </RadioGroup>
                    </STInputBox>

                    <Checkbox v-model="livesAtParents" v-if="livesAtParents || (age >= 18 && age <= 27)">Woont bij ouders</Checkbox>
                </div>

                <div>
                    <AddressInput title="Adres van dit lid" v-model="address" v-if="age >= 18 && !livesAtParents" :validator="validator"/>
                    <EmailInput title="E-mailadres" v-model="email" v-if="age >= 18" :validator="validator"/>
                    <PhoneInput title="GSM-nummer van dit lid" v-model="phone" :validator="validator" :required="age >= 18" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" v-if="age >= 12"/>
                </div>
            </div>

            <template v-if="suggestedGroup">
                <hr>
                <h2>Leeftijdsgroep: {{ suggestedGroup.settings.name }}</h2>
                <p>{{ suggestedGroup.settings.description }}</p>
            </template>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary">
                Volgende
            </button>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BirthDayInput, AddressInput, RadioGroup, Radio, PhoneInput, Checkbox, Validator, EmailInput } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, Group, Record, RecordType, MemberWithRegistrations, Version, EmergencyContact } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { MemberDetails } from '@stamhoofd/structures';
import MemberParentsView from './MemberParentsView.vue';
import { OrganizationManager } from '../../../../dashboard/src/classes/OrganizationManager';
import MemberGroupView from './MemberGroupView.vue';
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import EmergencyContactView from './EmergencyContactView.vue';
import MemberRecordsView from './MemberRecordsView.vue';
import { SessionManager } from '@stamhoofd/networking';

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
        Checkbox
    }
})
export default class MemberGeneralView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    member: MemberWithRegistrations | null

    memberDetails: MemberDetails | null = null
   
    firstName = ""
    lastName = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null

    // todo: replace with Addres and new input component
    address: Address | null = null
    email: string | null = null
    birthDay: Date | null = null
    gender = Gender.Male
    livesAtParents = false
    validator = new Validator()

    mounted() {
        if (this.member && this.member.details) {
            // Create a deep clone using encoding
            this.memberDetails = new ObjectData(this.member.details.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        }

        if (this.memberDetails) {
            this.firstName = this.memberDetails.firstName
            this.lastName = this.memberDetails.lastName
            this.phone = this.memberDetails.phone
            this.address = this.memberDetails.address
            this.birthDay = this.memberDetails.birthDay
            this.gender = this.memberDetails.gender
            this.livesAtParents = !this.memberDetails.address && this.age >= 18
            this.email = this.memberDetails.email
        }

        if (!this.email) {
            // Recommend the current user's email
            this.email = SessionManager.currentSession?.user?.email ?? null
        }
    }

    get age() {
        if (!this.birthDay) {
            return 0
        }
        const today = new Date();
        let age = today.getFullYear() - this.birthDay.getFullYear();
        const m = today.getMonth() - this.birthDay.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < this.birthDay.getDate())) {
            age--;
        }
        return age;
    }

    get suggestedGroup() {
        if (!this.birthDay) {
            return null
        }

        const mem = MemberDetails.create({
            firstName: this.firstName,
            lastName: this.lastName,
            gender: this.gender,
            phone: null,
            email: null,
            birthDay: this.birthDay,
            address: null
        })
        const organizization = OrganizationManager.organization
        const possibleGroups = mem.getMatchingGroups(organizization.groups)
        if (possibleGroups.length == 1) {
            return possibleGroups[0]
        }
        return null
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
            if (this.memberDetails) {
                // Keep all that was already chagned in next steps
                this.memberDetails.firstName = this.firstName
                this.memberDetails.lastName = this.lastName
                this.memberDetails.gender = this.gender
                this.memberDetails.phone = this.phone
                this.memberDetails.birthDay = this.birthDay!
                this.memberDetails.email = this.age >= 18 ? this.email : null
                this.memberDetails.address = this.livesAtParents ? null : this.address
            } else {
                this.memberDetails = MemberDetails.create({
                    firstName: this.firstName,
                    lastName: this.lastName,
                    gender: this.gender,
                    phone: this.phone,
                    email: this.age >= 18 ? this.email : null,
                    birthDay: this.birthDay!,
                    address: this.livesAtParents ? null : this.address
                })

                // Add default values for records
                this.memberDetails.records.push(Record.create({
                    type: RecordType.NoData
                }))
                this.memberDetails.records.push(Record.create({
                    type: RecordType.NoPictures
                }))
                if (this.memberDetails.age < 18) {
                    this.memberDetails.records.push(Record.create({
                        type: RecordType.NoPermissionForMedicines
                    }))
                }
            }
            
            if (!this.member || this.member.activeRegistrations.length == 0) {
                // todo: Get possible groups
                const organizization = OrganizationManager.organization
                const possibleGroups = this.memberDetails.getMatchingGroups(organizization.groups)

                if (possibleGroups.length == 0) {
                    this.errorBox = new ErrorBox(new SimpleError({
                        code: "",
                        message: "Oeps, "+this.memberDetails.firstName+" lijkt in geen enkele leeftijdsgroep te passen. Hij is waarschijnlijk te oud of te jong."
                    }))
                    return;
                }

                if (possibleGroups.length == 1) {
                    this.memberDetails.preferredGroupId = possibleGroups[0].id
                } else {
                    // go to group selection
                    this.show(new ComponentWithProperties(MemberGroupView, { 
                        member: this.memberDetails,
                        handler: (group: Group, component: MemberGroupView) => {
                            this.memberDetails!.preferredGroupId = group.id
                            this.goToParents(component)
                        }
                    }))
                    return;
                }
            }
            
            this.goToParents(this);
            
        }
    }

    goToParents(component: NavigationMixin) {
        if (!this.memberDetails) {
            return;
        }
        const memberDetails = this.memberDetails
        // todo: check age before asking parents
        if (this.memberDetails.age < 18 || this.livesAtParents) {
            component.show(new ComponentWithProperties(MemberParentsView, { 
                memberDetails: this.memberDetails,
                member: this.member
            }))
        } else {
            // Noodcontacten
            component.show(new ComponentWithProperties(EmergencyContactView, { 
                contact: this.memberDetails.emergencyContacts.length > 0 ? this.memberDetails.emergencyContacts[0] : null,
                handler: (contact: EmergencyContact, component: EmergencyContactView) => {
                    memberDetails.emergencyContacts = [contact]
                    
                    // go to the steekkaart view
                    component.show(new ComponentWithProperties(MemberRecordsView, { 
                        memberDetails: memberDetails,
                        member: this.member
                    }))
                }
            }))
        }
    }

    shouldNavigateAway() {
        if (confirm("Ben je zeker dat je dit venster wilt sluiten?")) {
            return true;
        }
        return false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#member-general-view {
    > main {
        > h2{
            @extend .style-title-2;
            padding-bottom: 15px;
        }

        > h2 + p {
            @extend .style-description;
        }

        > hr{
            @extend .style-hr;
        }

    }
}
</style>
