<template>
    <div id="member-records-view" class="st-view">
        <STNavigationBar title="Steekkaart">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
        
        <main>
            <h1>
                Persoonlijke steekkaart van {{ memberDetails.firstName }}<span v-tooltip="'Net zoals alle gegevens zijn deze versleuteld opgeslagen en is de toegang op een cryptografische manier vastgelegd.'" class="icon gray privacy middle" />
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <template v-if="shouldAsk(RecordType.DataPermissions, RecordType.PicturePermissions, RecordType.GroupPicturePermissions)">
                <hr>
                <h2>Privacy</h2>

                <template v-if="shouldAsk(RecordType.DataPermissions)">
                    <Checkbox v-if="privacyUrl" v-model="allowData" class="long-text">
                        Ik geef toestemming aan {{ organization.name }} om de gevoelige gegevens van {{ memberDetails.firstName }}, dewelke ik hieronder kan vermelden, te verzamelen en te verwerken (o.a. voor medische steekkaart). Hoe we met deze gegevens omgaan staat vermeld in <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
                    </Checkbox>
                    <Checkbox v-else v-model="allowData" class="long-text">
                        Ik geef toestemming aan {{ organization.name }} om de gevoelige gegevens van {{ memberDetails.firstName }}, dewelke ik hieronder kan vermelden, te verzamelen en te verwerken (o.a. voor medische steekkaart).
                    </Checkbox>
                    <Checkbox v-if="allowData && memberDetails.age < 18" v-model="isParent" class="long-text">
                        Ik ben wettelijke voogd of ouder van {{ memberDetails.firstName }} en mag deze toestemming geven.
                    </Checkbox>
                </template>

                <Checkbox v-if="shouldAsk(RecordType.PicturePermissions)" v-model="allowPictures" class="long-text">
                    {{ memberDetails.firstName }} mag tijdens de activiteiten worden gefotografeerd voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>
                <Checkbox v-if="(!allowPictures || !shouldAsk(RecordType.PicturePermissions)) && shouldAsk(RecordType.GroupPicturePermissions)" v-model="allowGroupPictures" class="long-text">
                    Ik geef wel toestemming voor de publicatie van groepsfoto's met {{ memberDetails.firstName }} voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>

                <p v-if="!allowData" class="warning-box">
                    Je bent vrij om geen gevoelige gegevens in te vullen, maar dan aanvaard je uiteraard ook de risico's die ontstaan doordat {{ organization.name }} geen weet heeft van belangrijke zaken en daar niet op kan reageren in de juiste situaties (bv. allergisch voor bepaalde stof).
                </p>
            </template>

            <template v-if="allowData">
                <template v-if="shouldAsk(RecordType.FoodAllergies, RecordType.MedicineAllergies, RecordType.HayFever, RecordType.OtherAllergies)">
                    <hr>
                    <h2>Allergieën</h2>

                    <RecordCheckbox v-if="shouldAsk(RecordType.FoodAllergies)" v-model="records" :type="RecordType.FoodAllergies" placeholder="Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.MedicineAllergies)" v-model="records" :type="RecordType.MedicineAllergies" placeholder="Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.HayFever)" v-model="records" :type="RecordType.HayFever" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.OtherAllergies)" v-model="records" :type="RecordType.OtherAllergies" placeholder="Som hier op welke zaken" />
                </template>

                <template v-if="shouldAsk(RecordType.Vegetarian, RecordType.Vegan, RecordType.Halal, RecordType.Kosher, RecordType.Diet)">
                    <hr>
                    <h2>Dieet</h2>

                    <RecordCheckbox v-if="shouldAsk(RecordType.Vegetarian)" v-model="records" :type="RecordType.Vegetarian" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.Vegan)" v-model="records" :type="RecordType.Vegan" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.Halal)" v-model="records" :type="RecordType.Halal" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.Kosher)" v-model="records" :type="RecordType.Kosher" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.Diet)" v-model="records" name="Ander dieet" :type="RecordType.Diet" placeholder="Beschrijving van ander soort dieet. Let op, allergieën hoef je hier niet nog eens te vermelden."/>
                </template>

                <template v-if="shouldAsk(RecordType.Asthma, RecordType.BedWaters, RecordType.Epilepsy, RecordType.HeartDisease, RecordType.SkinCondition, RecordType.Rheumatism, RecordType.SleepWalking, RecordType.Diabetes, RecordType.Medicines, RecordType.SpecialHealthCare)">
                    <hr>
                    <h2>Gezondheid, hygiëne &amp; slapen</h2>

                    <RecordCheckbox :key="type" v-for="type in [RecordType.Asthma, RecordType.BedWaters, RecordType.Epilepsy, RecordType.HeartDisease, RecordType.SkinCondition, RecordType.Rheumatism, RecordType.SleepWalking, RecordType.Diabetes ]" v-if="shouldAsk(type)" v-model="records" :type="type" :comments="true"/>
                    <RecordCheckbox v-if="shouldAsk(RecordType.Medicines)" v-model="records" :type="RecordType.Medicines" placeholder="Welke, wanneer en hoe vaak?" comment="Gelieve ons ook de noodzakelijke doktersattesten te bezorgen."/>
                    <RecordCheckbox v-if="shouldAsk(RecordType.SpecialHealthCare)" v-model="records" :type="RecordType.SpecialHealthCare" placeholder="Welke?" />
                </template>

                <template v-if="shouldAsk(RecordType.CanNotSwim, RecordType.TiredQuickly, RecordType.CanNotParticipateInSport, RecordType.SpecialSocialCare)">
                    <hr>
                    <h2>Sport, spel &amp; sociale omgang</h2>

                    <RecordCheckbox v-if="shouldAsk(RecordType.CanNotSwim)" v-model="records" :type="RecordType.CanNotSwim"/>
                    <RecordCheckbox v-if="shouldAsk(RecordType.TiredQuickly)" v-model="records" :type="RecordType.TiredQuickly"/>
                    <RecordCheckbox v-if="shouldAsk(RecordType.CanNotParticipateInSport)" v-model="records" :type="RecordType.CanNotParticipateInSport" placeholder="Meer informatie" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.SpecialSocialCare)" v-model="records" :type="RecordType.SpecialSocialCare" placeholder="Meer informatie"/>
                </template>

                <template v-if="shouldAsk(RecordType.Other)">
                    <hr>
                    <h2>Andere inlichtingen</h2>
                    <textarea v-model="otherDescription" class="input" placeholder="Enkel invullen indien van toepassing" />
                </template>
            </template>

            <template v-if="(memberDetails.age !== null && memberDetails.age < 18) && shouldAsk(RecordType.MedicinePermissions)">
                <hr>
                <h2>Toedienen van medicatie</h2>

                <p class="style-description">
                    Het is verboden om als begeleid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via deze steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp.
                </p>

                <Checkbox v-model="allowMedicines">
                    Wij geven toestemming aan de begeleiders om bij hoogdringendheid aan onze zoon of dochter een dosis via de apotheek vrij verkrijgbare pijnstillende en koortswerende medicatie toe te dienen*
                </Checkbox>

                <p class="style-description-small">
                    * gebaseerd op aanbeveling Kind & Gezin 09.12.2009 – Aanpak van koorts / Toedienen van geneesmiddelen in de kinderopvang
                </p>
            </template>
        
            <template v-if="allowData">
                <template v-if="doctorRequired || doctorOptional">
                    <hr>
                    <h2>Contactgegevens huisarts</h2>

                    <div class="split-inputs">
                        <div>
                            <STInputBox title="Naam huisarts" error-fields="doctorName" :error-box="errorBox">
                                <input v-model="doctorName" class="input" name="doctorName" type="text" placeholder="Huisarts of prakijknaam" autocomplete="name">
                            </STInputBox>
                        </div>

                        <div>
                            <PhoneInput v-model="doctorPhone" title="Telefoonnummer huisarts" :validator="validator" placeholder="Telefoonnummer" :required="!doctorOptional" />
                        </div>
                    </div>
                </template>
            </template>
        </main>
        <STToolbar>
            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" @click="goNext">
                    Doorgaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, ErrorBox, LoadingButton,PhoneInput, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip, Validator } from "@stamhoofd/components"
import { AskRequirement, EmergencyContact,MemberDetails, Record, RecordType } from "@stamhoofd/structures"
import { MemberWithRegistrations } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import RecordCheckbox from './RecordCheckbox.vue';

@Component({
    "components": {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        PhoneInput,
        LoadingButton,
        RecordCheckbox
    },
    "directives": { Tooltip }
})
export default class MemberRecordsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberWithRegistrations
    
    get memberDetails(): MemberDetails {
        return this.member.details!
    }

    organization = OrganizationManager.organization

    validator = new Validator()
    errorBox: ErrorBox | null = null

    doctorName = ""
    doctorPhone: string | null = null

    isParent = false
    loading = false

    mounted() {
        if (this.member && (this.memberDetails.age ?? 99) < 18 && this.memberDetails.lastReviewed !== null) {
            // already accepted previous time
            this.isParent = true
        }

        if (this.memberDetails) {
            this.doctorName = this.memberDetails.doctor?.name ?? ""
            this.doctorPhone = this.memberDetails.doctor?.phone ?? ""
        }

        if (!this.memberDetails || !this.memberDetails.doctor) {
            const doctor = MemberManager.getDoctor()
            if (doctor) {
                this.doctorName = doctor.name
                this.doctorPhone = doctor.phone
            }
        }
    }

    get doctorRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.doctor === AskRequirement.Required
    }

    get doctorOptional() {
        return OrganizationManager.organization.meta.recordsConfiguration.doctor === AskRequirement.Optional
    }

    shouldAsk(...types: RecordType[]) {
        return OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(...types)
    }

    get RecordType() {
        return RecordType
    }


    get privacyUrl(): string | null {
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.errorBox =  null;

        if (this.allowData) {
            const errors = new SimpleErrors()
            if (this.doctorRequired && this.doctorName.length < 2) {
                errors.addError(new SimpleError({
                    code: "invalid_field",
                    message: "Vul de naam van de dokter in",
                    field: "doctorName"
                }))
            }

            const valid = await this.validator.validate()

            if (!valid || errors.errors.length > 0) {
                if (errors.errors.length > 0) {
                    this.errorBox = new ErrorBox(errors)
                }
                return;
            }

            if (this.doctorRequired || (this.doctorOptional && (this.doctorName.length > 0 || (this.doctorPhone?.length ?? 0) > 0))) {
                this.memberDetails.doctor = EmergencyContact.create({
                    name: this.doctorName,
                    phone: this.doctorPhone,
                    title: "Huisdokter"
                })
            } else {
                this.memberDetails.doctor = null
            }

            
        } else {
            // Remove all records except...
            this.memberDetails.records = this.memberDetails.records.filter(r => r.type == RecordType.PicturePermissions || r.type == RecordType.GroupPicturePermissions || r.type == RecordType.MedicinePermissions )
            this.memberDetails.doctor = null
        }

        // Filter records (remove records that were disabled and might be already saved somehow)
        this.memberDetails.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(this.memberDetails.records)

        if (!this.memberDetails.age || this.memberDetails.age >= 18) {
            // remove medicine permission (not needed any longer)
            this.memberDetails.records = this.memberDetails.records.filter(r => r.type !== RecordType.MedicinePermissions)
        }
        
        this.memberDetails.lastReviewed = new Date()

        this.loading = true

        try {
            await MemberManager.patchAllMembersWith(this.member)

            this.dismiss({ force: true })
        } catch (e) {
            console.error(e);
            alert("Er ging iets mis...")
        }
    }

    get allowData() { return this.getBooleanType(RecordType.DataPermissions) }
    set allowData(enabled: boolean) { this.setBooleanType(RecordType.DataPermissions, enabled) }
    
    
    get allowPictures() { return this.getBooleanType(RecordType.PicturePermissions) }
    set allowPictures(enabled: boolean) { 
        this.setBooleanType(RecordType.PicturePermissions, enabled) 
    }

    get allowGroupPictures() { 
        return this.getBooleanType(RecordType.GroupPicturePermissions)
    }

    set allowGroupPictures(enabled: boolean) { 
        this.setBooleanType(RecordType.GroupPicturePermissions, enabled) 
    }

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
        if (enabled) {
            this.memberDetails.records.push(Record.create({
                type,
            }))
        } else {
            this.memberDetails.records.splice(index, 1)
        }
    }

    get records() {
        return this.memberDetails.records
    }

    set records(records: Record[]) {
        this.memberDetails.records = records
    }

    getTypeDescription(type: RecordType) {
        const record = this.memberDetails.records.find(r => r.type == type)
        if (!record) {
            return ""
        }
        return record.description
    }

    setTypeDescription(type: RecordType, description: string) {
        const record = this.memberDetails.records.find(r => r.type == type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }
        record.description = description
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#member-records-view {
    > main {
        > .checkbox + .textarea-container {
            padding-bottom: 20px;
            padding-left: 35px;

            @media (max-width: 450px) {
                padding-left: 0;
            }
        }
    }
}
</style>
