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

        </main>

        <STToolbar>
            <LoadingButton :loading="loading" slot="right">
                <button class="button primary">
                    Volgende
                </button>
            </LoadingButton>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BirthDayInput, AddressInput, RadioGroup, Radio, PhoneInput, Checkbox, Validator, EmailInput, LoadingButton } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, Group, Record, RecordType, MemberWithRegistrations, Version, EmergencyContact, WaitingListType, PreferredGroup } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { MemberDetails } from '@stamhoofd/structures';
import MemberParentsView from './MemberParentsView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from './MemberGroupView.vue';
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import EmergencyContactView from './EmergencyContactView.vue';
import MemberRecordsView from './MemberRecordsView.vue';
import { SessionManager } from '@stamhoofd/networking';
import MemberExistingQuestionView from './MemberExistingQuestionView.vue';
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
        EmailInput,
        Checkbox,
        LoadingButton
    }
})
export default class MemberGeneralView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    member: MemberWithRegistrations | null

    loading = false

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

    async goNext() {
        if (this.loading) {
            return;
        }
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
                this.show(new ComponentWithProperties(MemberGroupView, { 
                    memberDetails: this.memberDetails,
                    member: this.member,
                    handler: (component: MemberGroupView) => {
                        this.goToParents(component)
                    }
                }))
                return;
            }
            
            this.goToParents(this);
            
        }
    }

    async goToParents(component: NavigationMixin) {
        if (!this.memberDetails) {
            return;
        }

        if (this.memberDetails.preferredGroups.length == 0) {
            // hmm
            console.warn("Cannot go to parents if no preferred groups are set")
            return;
        }

        const waitingList = !!this.memberDetails.preferredGroups.find(g => g.waitingList) || (this.member && this.member.waitingGroups.length > 0 && this.member.groups.length == 0)

        // todo: if waiting list -> end here
        if (waitingList) {
            this.loading = true;
            (component as any).loading = true;

            try {
                if (this.member) {
                    this.member.details = this.memberDetails
                    await MemberManager.patchAllMembers()
                } else {
                    await MemberManager.addMember(this.memberDetails)
                }
            } catch (e) {
                this.errorBox = new ErrorBox(e)
                this.loading = false;
                (component as any).loading = false;
                return;
            }
           
            this.dismiss({ force: true })
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