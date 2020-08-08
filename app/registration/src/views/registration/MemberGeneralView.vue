<template>
    <form id="member-general-view" class="st-view" @submit.prevent="goNext">
        <STNavigationBar title="Inschrijven">
            <button slot="right" class="button icon gray close" @click="pop" type="button"></button>
        </STNavigationBar>
        
        <main>
            <h1 v-if="!member">
                Wie ga je inschrijven?
            </h1>
            <h1 v-else-if="wasInvalid">
                Gegevens aanvullen van {{ member.details ? member.details.firstName : member.firstName }}
            </h1>
            <h1 v-else-if="!member.details">
                Gegevens herstellen van {{ member.firstName }}
            </h1>
            <h1 v-else>
                Gegevens wijzigen van {{ member.details ? member.details.firstName : member.firstName }}
            </h1>

            <p v-if="member && !member.details" class="info-box">Jouw account beschikt niet meer over de sleutel om de gegevens van {{ member.firstName }} te ontcijferen. Dit kan voorkomen als je bijvoorbeeld je wachtwoord was vergeten, of als je ingelogd bent met een ander account dan je oorspronkelijk had gebruikt om {{ member.firstName }} in te schrijven. Je moet de gegevens daarom opnieuw ingeven.</p>

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
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, Group, Record, RecordType, MemberWithRegistrations, Version, EmergencyContact, WaitingListType, PreferredGroup, MemberExistingStatus } from "@stamhoofd/structures"
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
    initialMember: MemberWithRegistrations | null

    member: MemberWithRegistrations | null = this.initialMember

    @Prop({ default: null })
    beforeCloseHandler: (() => void) | null;

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

    wasInvalid = false

    mounted() {
        if (this.member) {
            if (this.member.details) {
                // Create a deep clone using encoding
                this.member = new ObjectData(this.member.encode({ version: Version }), { version: Version }).decode(MemberWithRegistrations as Decoder<MemberWithRegistrations>)
                this.memberDetails = this.member.details
            } else {
                this.firstName = this.member.firstName
            }
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

        this.wasInvalid = !(this.member?.isCompleteForSelectedGroups(OrganizationManager.organization.groups) ?? true)
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

            if (this.member) {
                // Double check if everything is synced
                this.member.details = this.memberDetails
            }
            
            if (!this.member || this.member.canRegister(OrganizationManager.organization.groups)) {
                if (!(await this.saveData(this))) {
                    return;
                }

                // Automatically fill in member existing status if not set or expired
                if ((this.memberDetails.existingStatus === null || this.memberDetails.existingStatus.isExpired())) {
                    this.memberDetails.existingStatus = null;

                    if (this.member && this.member.inactiveRegistrations.length > 0) {
                        // Are these registrations active?
                        this.memberDetails.existingStatus = MemberExistingStatus.create({
                            isNew: false,
                            hasFamily: false, // unknown (doesn't matter atm if not new)
                        })
                    }
                }

                // Check if we need to ask existing status
                const shouldAsk = !!this.member!.getSelectableGroups(OrganizationManager.organization.groups).find(g => g.askExistingStatus)

                if (!shouldAsk) {
                    this.chooseGroup(this)
                } else {
                    this.askExistingStatus(this);
                }
                return;
            }
            
            this.goToParents(this);
            
        }
    }

    askExistingStatus(component: NavigationMixin) {
        component.show(new ComponentWithProperties(MemberExistingQuestionView, {
            member: this.memberDetails,
            handler: (component) => {
                this.chooseGroup(component, true)
            }
        }))
    }

    chooseGroup(component: NavigationMixin, replace: boolean = false) {
        this.navigationController!.push(new ComponentWithProperties(MemberGroupView, { 
            member: this.member,
            handler: (component: MemberGroupView) => {
                this.goToParents(component)
            }
        }), true, replace ? (this.navigationController!.components.length - 1) : 0)
        return;
    }

    async saveData(component: { loading: boolean; errorBox: ErrorBox | null }) {
         if (!this.memberDetails) {
            return false;
        }

        const o = this.memberDetails
        component.loading = true
        
        try {
            if (this.member) {
                await MemberManager.patchAllMembersWith(this.member)
            } else {
                const m = await MemberManager.addMember(this.memberDetails)
                if (!m) {
                    throw new SimpleError({
                        code: "expected_member",
                        message: "Er ging iets mis bij het opslaan."
                    })
                }
                this.member = m
                this.memberDetails = m.details
            }

            component.errorBox = null
            component.loading = false;
            return true
        } catch (e) {
            component.errorBox = new ErrorBox(e)
            component.loading = false;
            return false;
        }
    }

    async goToParents(component: NavigationMixin & { loading: boolean; errorBox: ErrorBox | null }) {
        if (!this.memberDetails) {
            return;
        }

        // Already save here
        if (!(await this.saveData(component))) {
            return;
        }

        if (!this.member) {
            // we should always have a member
            console.error("Expected to have a member at the end of the general view")
            return;
        }

        // Check if we need to stop here (e.g. because we are only going to register on a waiting list
        if (!this.member.shouldAskDetails(OrganizationManager.organization.groups)) {
            this.dismiss({ force: true })
            return;
        }

        const memberDetails = this.member.details!
        // todo: check age before asking parents
        if (memberDetails.age < 18 || this.livesAtParents) {
            component.show(new ComponentWithProperties(MemberParentsView, { 
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

    destroyed() {
        console.log("destroyed")
        if (this.beforeCloseHandler) this.beforeCloseHandler()
    }
}
</script>