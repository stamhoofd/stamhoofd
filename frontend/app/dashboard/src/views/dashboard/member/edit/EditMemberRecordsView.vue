<template>
    <form id="member-records-view" class="view" @submit.prevent="goNext">
        <main>
            <STErrorsDefault :error-box="errorBox" />
            <p v-if="!allowData" class="warning-box">
                Er werd geen toestemming gegeven voor het verzamelen van gevoelige gegevens. Je kan daarom de steekkaart niet invullen. De toestemming kan gewijzigd worden door het lid door in te loggen en de steekkaart te wijzigen.
            </p>

            <template v-if="allowData">
                <h2>Allergieën</h2>

                <Checkbox v-model="foodAllergies">
                    Allergisch of overgevoelig voor bepaalde voeding
                </Checkbox>
                <div v-if="foodAllergies" class="textarea-container">
                    <textarea v-model="foodAllergiesDescription" class="input" placeholder="Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden" />
                </div>

                <Checkbox v-model="medicineAllergies">
                    Allergisch voor geneesmiddelen
                </Checkbox>
                <div v-if="medicineAllergies" class="textarea-container">
                    <textarea v-model="medicineAllergiesDescription" class="input" placeholder="Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden" />
                </div>

                <Checkbox v-model="hayFever">
                    Hooikoorts
                </Checkbox>
                <div v-if="false && hayFever" class="textarea-container">
                    <textarea v-model="hayFeverDescription" class="input" placeholder="Eventuele opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="otherAllergies">
                    Allergisch voor andere zaken (verf, insecten...)
                </Checkbox>
                <div v-if="otherAllergies" class="textarea-container">
                    <textarea v-model="otherAllergiesDescription" class="input" placeholder="Som hier op welke zaken." />
                </div>

                <hr>
                <h2>Dieet</h2>

                <Checkbox v-model="vegetarian">
                    Vegetarisch dieet
                </Checkbox>
                <Checkbox v-model="vegan">
                    Veganistisch dieet (geen dierlijke producten)
                </Checkbox>
                <Checkbox v-model="halal">
                    Halal dieet
                </Checkbox>
                <Checkbox v-model="kosher">
                    Koosjer dieet
                </Checkbox>

                <Checkbox v-model="diet">
                    Ander dieet (geen allergieën)
                </Checkbox>
                <div v-if="diet" class="textarea-container">
                    <textarea v-model="dietDescription" class="input" placeholder="Beschrijving van ander soort dieet. Let op, allergieën hoef je hier niet nog eens te vermelden." />
                </div>

                <hr>
                <h2>Gezondheid, hygiëne &amp; slapen</h2>

                <Checkbox v-model="asthma">
                    Astma
                </Checkbox>
                <div v-if="asthma" class="textarea-container">
                    <textarea v-model="asthmaDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="bedWaters">
                    Bedwateren
                </Checkbox>
                <div v-if="bedWaters" class="textarea-container">
                    <textarea v-model="bedWatersDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="epilepsy">
                    Epilepsie
                </Checkbox>
                <div v-if="epilepsy" class="textarea-container">
                    <textarea v-model="epilepsyDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="heartDisease">
                    Hartkwaal
                </Checkbox>
                <div v-if="heartDisease" class="textarea-container">
                    <textarea v-model="heartDiseaseDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="skinCondition">
                    Huidaandoening
                </Checkbox>
                <div v-if="skinCondition" class="textarea-container">
                    <textarea v-model="skinConditionDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="rheumatism">
                    Reuma
                </Checkbox>
                <div v-if="rheumatism" class="textarea-container">
                    <textarea v-model="rheumatismDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="sleepWalking">
                    Slaapwandelen
                </Checkbox>
                <div v-if="sleepWalking" class="textarea-container">
                    <textarea v-model="sleepWalkingDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="diabetes">
                    Suikerziekte
                </Checkbox>
                <div v-if="diabetes" class="textarea-container">
                    <textarea v-model="diabetesDescription" class="input" placeholder="Opmerkingen (optioneel)" />
                </div>

                <Checkbox v-model="medicines">
                    Moet geneesmiddelen nemen (dagelijks, wekelijks...)
                </Checkbox>
                <div v-if="medicines" class="textarea-container">
                    <textarea v-model="medicinesDescription" class="input" placeholder="Welke, wanneer en hoe vaak?" />
                    <p>Gelieve ons ook de noodzakelijke doktersattesten te bezorgen.</p>
                </div>

                <Checkbox v-model="specialHealthCare">
                    Er is bijzondere aandacht nodig om risico's te voorkomen
                </Checkbox>
                <div v-if="specialHealthCare" class="textarea-container">
                    <textarea v-model="specialHealthCareDescription" class="input" placeholder="Welke?" />
                </div>

                <hr>
                <h2>Sport, spel en sociale omgang</h2>

                <Checkbox v-model="canNotSwim">
                    Kan niet (of onvoldoende) zwemmen
                </Checkbox>

                <Checkbox v-model="tiredQuickly">
                    Vlug moe
                </Checkbox>
                <div v-if="tiredQuickly" class="textarea-container">
                    <textarea v-model="tiredQuicklyDescription" class="input" placeholder="Eventuele opmerkingen" />
                </div>

                <Checkbox v-model="canNotParticipateInSport">
                    Kan niet deelnemen aan sport en spel afgestemd op hun leeftijd
                </Checkbox>
                <div v-if="canNotParticipateInSport" class="textarea-container">
                    <textarea v-model="canNotParticipateInSportDescription" class="input" placeholder="Meer informatie" />
                </div>

                <Checkbox v-model="specialSocialCare">
                    Er is bijzondere aandacht nodig bij sociale omgang
                </Checkbox>
                <div v-if="specialSocialCare" class="textarea-container">
                    <textarea v-model="specialSocialCareDescription" class="input" placeholder="Meer informatie" />
                </div>

                <hr>
                <h2>Andere inlichtingen</h2>

                <textarea v-model="otherDescription" class="input" placeholder="Enkel invullen indien van toepassing" />

                <hr>
                <h2>Contactgegevens huisarts</h2>

                <div class="split-inputs">
                    <div>
                        <STInputBox title="Naam huisarts" error-fields="doctorName" :error-box="errorBox">
                            <input v-model="doctorName" class="input" name="doctorName" type="text" placeholder="Huisarts of prakijknaam" autocomplete="name">
                        </STInputBox>
                    </div>

                    <div>
                        <PhoneInput v-model="doctorPhone" title="Telefoonnummer huisarts" :validator="validator" placeholder="Telefoonnummer" :required="false" />
                    </div>
                </div>
            </template>
        </main>
    </form>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Address, Country, EmergencyContact, Gender, Group, MemberExistingStatus,MemberWithRegistrations, Organization, OrganizationMetaData, OrganizationType, PreferredGroup, Record, RecordType, Version, WaitingListType } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
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
    },
    model: {
        prop: 'memberDetails',
        event: 'change'
    },
})
export default class EditMemberRecordsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    memberDetails!: MemberDetails            

    errorBox: ErrorBox | null = null
    validator = new Validator()

    doctorName = ""
    doctorPhone: string | null = null

    mounted() {
        if (this.memberDetails) {
            this.doctorName = this.memberDetails.doctor?.name ?? ""
            this.doctorPhone = this.memberDetails.doctor?.phone ?? null
        }
    }
   
    async validate() {
        if (!this.memberDetails) {
            return true;
        }

        if (!this.allowData) {
            return true;
        }

        const errors = new SimpleErrors()
        
        // Don't need to validate doctor
        /*if (this.doctorName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de naam van de dokter in",
                field: "doctorName"
            }))
        }*/
        
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (valid) {
            const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)

            if (this.doctorName.length > 0 || this.doctorPhone) {
                memberDetails.doctor = EmergencyContact.create({
                    name: this.doctorName,
                    phone: this.doctorPhone && this.doctorPhone.length > 0 ? this.doctorPhone : null,
                    title: "Huisdokter"
                })
            } else {
                memberDetails.doctor = null
            }

            this.$emit("change", memberDetails)
            
            return true;
        }
        return false
    }

    get allowData() { return this.getBooleanType(RecordType.DataPermissions) }
    set allowData(enabled: boolean) { this.setBooleanType(RecordType.DataPermissions, enabled) }

    get allowPictures() { return this.getBooleanType(RecordType.PicturePermissions) }
    set allowPictures(enabled: boolean) { this.setBooleanType(RecordType.PicturePermissions, enabled)} 
    
    get allowOnlyGroupPictures() { return this.getBooleanType(RecordType.GroupPicturePermissions) }
    set allowOnlyGroupPictures(enabled: boolean) { this.setBooleanType(RecordType.GroupPicturePermissions, enabled)}

    get allowMedicines() { return this.getBooleanType(RecordType.MedicinePermissions) }
    set allowMedicines(enabled: boolean) { this.setBooleanType(RecordType.MedicinePermissions, enabled) }

    get foodAllergies() { return this.getBooleanType(RecordType.FoodAllergies) }
    set foodAllergies(enabled: boolean) { this.setBooleanType(RecordType.FoodAllergies, enabled) }
    get foodAllergiesDescription() { return this.getTypeDescription(RecordType.FoodAllergies) }
    set foodAllergiesDescription(description: string) { this.setTypeDescription(RecordType.FoodAllergies, description) }

    get medicineAllergies() { return this.getBooleanType(RecordType.MedicineAllergies) }
    set medicineAllergies(enabled: boolean) { this.setBooleanType(RecordType.MedicineAllergies, enabled) }
    get medicineAllergiesDescription() { return this.getTypeDescription(RecordType.MedicineAllergies) }
    set medicineAllergiesDescription(description: string) { this.setTypeDescription(RecordType.MedicineAllergies, description) }

    get hayFever() { return this.getBooleanType(RecordType.HayFever) }
    set hayFever(enabled: boolean) { this.setBooleanType(RecordType.HayFever, enabled) }
    get hayFeverDescription() { return this.getTypeDescription(RecordType.HayFever) }
    set hayFeverDescription(description: string) { this.setTypeDescription(RecordType.HayFever, description) }

    get otherAllergies() { return this.getBooleanType(RecordType.OtherAllergies) }
    set otherAllergies(enabled: boolean) { this.setBooleanType(RecordType.OtherAllergies, enabled) }
    get otherAllergiesDescription() { return this.getTypeDescription(RecordType.OtherAllergies) }
    set otherAllergiesDescription(description: string) { this.setTypeDescription(RecordType.OtherAllergies, description) }

    get vegetarian() { return this.getBooleanType(RecordType.Vegetarian) }
    set vegetarian(enabled: boolean) { this.setBooleanType(RecordType.Vegetarian, enabled) }

    get vegan() { return this.getBooleanType(RecordType.Vegan) }
    set vegan(enabled: boolean) { this.setBooleanType(RecordType.Vegan, enabled) }

    get halal() { return this.getBooleanType(RecordType.Halal) }
    set halal(enabled: boolean) { this.setBooleanType(RecordType.Halal, enabled) }

    get kosher() { return this.getBooleanType(RecordType.Kosher) }
    set kosher(enabled: boolean) { this.setBooleanType(RecordType.Kosher, enabled) }

    get diet() { return this.getBooleanType(RecordType.Diet) }
    set diet(enabled: boolean) { this.setBooleanType(RecordType.Diet, enabled) }
    get dietDescription() { return this.getTypeDescription(RecordType.Diet) }
    set dietDescription(description: string) { this.setTypeDescription(RecordType.Diet, description) }

    get asthma() { return this.getBooleanType(RecordType.Asthma) }
    set asthma(enabled: boolean) { this.setBooleanType(RecordType.Asthma, enabled) }
    get asthmaDescription() { return this.getTypeDescription(RecordType.Asthma) }
    set asthmaDescription(description: string) { this.setTypeDescription(RecordType.Asthma, description) }

    get bedWaters() { return this.getBooleanType(RecordType.BedWaters) }
    set bedWaters(enabled: boolean) { this.setBooleanType(RecordType.BedWaters, enabled) }
    get bedWatersDescription() { return this.getTypeDescription(RecordType.BedWaters) }
    set bedWatersDescription(description: string) { this.setTypeDescription(RecordType.BedWaters, description) }

    get epilepsy() { return this.getBooleanType(RecordType.Epilepsy) }
    set epilepsy(enabled: boolean) { this.setBooleanType(RecordType.Epilepsy, enabled) }
    get epilepsyDescription() { return this.getTypeDescription(RecordType.Epilepsy) }
    set epilepsyDescription(description: string) { this.setTypeDescription(RecordType.Epilepsy, description) }

    get heartDisease() { return this.getBooleanType(RecordType.HeartDisease) }
    set heartDisease(enabled: boolean) { this.setBooleanType(RecordType.HeartDisease, enabled) }
    get heartDiseaseDescription() { return this.getTypeDescription(RecordType.HeartDisease) }
    set heartDiseaseDescription(description: string) { this.setTypeDescription(RecordType.HeartDisease, description) }

    get skinCondition() { return this.getBooleanType(RecordType.SkinCondition) }
    set skinCondition(enabled: boolean) { this.setBooleanType(RecordType.SkinCondition, enabled) }
    get skinConditionDescription() { return this.getTypeDescription(RecordType.SkinCondition) }
    set skinConditionDescription(description: string) { this.setTypeDescription(RecordType.SkinCondition, description) }

    get rheumatism() { return this.getBooleanType(RecordType.Rheumatism) }
    set rheumatism(enabled: boolean) { this.setBooleanType(RecordType.Rheumatism, enabled) }
    get rheumatismDescription() { return this.getTypeDescription(RecordType.Rheumatism) }
    set rheumatismDescription(description: string) { this.setTypeDescription(RecordType.Rheumatism, description) }

    get sleepWalking() { return this.getBooleanType(RecordType.SleepWalking) }
    set sleepWalking(enabled: boolean) { this.setBooleanType(RecordType.SleepWalking, enabled) }
    get sleepWalkingDescription() { return this.getTypeDescription(RecordType.SleepWalking) }
    set sleepWalkingDescription(description: string) { this.setTypeDescription(RecordType.SleepWalking, description) }
 
    get diabetes() { return this.getBooleanType(RecordType.Diabetes) }
    set diabetes(enabled: boolean) { this.setBooleanType(RecordType.Diabetes, enabled) }
    get diabetesDescription() { return this.getTypeDescription(RecordType.Diabetes) }
    set diabetesDescription(description: string) { this.setTypeDescription(RecordType.Diabetes, description) }

    get medicines() { return this.getBooleanType(RecordType.Medicines) }
    set medicines(enabled: boolean) { this.setBooleanType(RecordType.Medicines, enabled) }
    get medicinesDescription() { return this.getTypeDescription(RecordType.Medicines) }
    set medicinesDescription(description: string) { this.setTypeDescription(RecordType.Medicines, description) }

    get specialHealthCare() { return this.getBooleanType(RecordType.SpecialHealthCare) }
    set specialHealthCare(enabled: boolean) { this.setBooleanType(RecordType.SpecialHealthCare, enabled) }
    get specialHealthCareDescription() { return this.getTypeDescription(RecordType.SpecialHealthCare) }
    set specialHealthCareDescription(description: string) { this.setTypeDescription(RecordType.SpecialHealthCare, description) }

    get canNotSwim() { return this.getBooleanType(RecordType.CanNotSwim) }
    set canNotSwim(enabled: boolean) { this.setBooleanType(RecordType.CanNotSwim, enabled) }

    get tiredQuickly() { return this.getBooleanType(RecordType.TiredQuickly) }
    set tiredQuickly(enabled: boolean) { this.setBooleanType(RecordType.TiredQuickly, enabled) }
    get tiredQuicklyDescription() { return this.getTypeDescription(RecordType.TiredQuickly) }
    set tiredQuicklyDescription(description: string) { this.setTypeDescription(RecordType.TiredQuickly, description) }

    get canNotParticipateInSport() { return this.getBooleanType(RecordType.CanNotParticipateInSport) }
    set canNotParticipateInSport(enabled: boolean) { this.setBooleanType(RecordType.CanNotParticipateInSport, enabled) }
    get canNotParticipateInSportDescription() { return this.getTypeDescription(RecordType.CanNotParticipateInSport) }
    set canNotParticipateInSportDescription(description: string) { this.setTypeDescription(RecordType.CanNotParticipateInSport, description) }

    get specialSocialCare() { return this.getBooleanType(RecordType.SpecialSocialCare) }
    set specialSocialCare(enabled: boolean) { this.setBooleanType(RecordType.SpecialSocialCare, enabled) }
    get specialSocialCareDescription() { return this.getTypeDescription(RecordType.SpecialSocialCare) }
    set specialSocialCareDescription(description: string) { this.setTypeDescription(RecordType.SpecialSocialCare, description) }

    get otherDescription() { return this.getTypeDescription(RecordType.Other) }
    set otherDescription(description: string) { 
        if (description.length > 0) { 
            this.setBooleanType(RecordType.Other, true)
            this.setTypeDescription(RecordType.Other, description) 
        } else {
            this.setBooleanType(RecordType.Other, false)
        }
    }

    // Helpers ---

    getBooleanType(type: RecordType) {
        return !!this.memberDetails.records.find(r => r.type == type)
    }

    setBooleanType(type: RecordType, enabled: boolean) {
        const index = this.memberDetails.records.findIndex(r => r.type == type)
        if ((index != -1) === enabled) {
            return
        }

        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)

        if (enabled) {
            memberDetails.records.push(Record.create({
                type,
            }))
        } else {
            memberDetails.records.splice(index, 1)
        }
        this.$emit("change", memberDetails)
    }

    getTypeDescription(type: RecordType) {
        const record = this.memberDetails.records.find(r => r.type == type)
        if (!record) {
            return ""
        }
        return record.description
    }

    setTypeDescription(type: RecordType, description: string) {
        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        const record = memberDetails.records.find(r => r.type == type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }

        record.description = description
        this.$emit("change", memberDetails)
    }
}
</script>