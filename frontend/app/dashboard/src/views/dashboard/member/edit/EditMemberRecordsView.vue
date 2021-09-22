<template>
    <form id="member-records-view" class="view" @submit.prevent="goNext">
        <main>
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="shouldAsk(LegacyRecordType.DataPermissions, LegacyRecordType.PicturePermissions, LegacyRecordType.GroupPicturePermissions)">
                <h2>Privacy</h2>

                <p class="info-box">
                    Maak hier niet zomaar wijzigingen.
                </p>

                <template v-if="shouldAsk(LegacyRecordType.DataPermissions)">
                    <Checkbox v-model="allowData" class="long-text">
                        Toestemming om de gevoelige gegevens van {{ memberDetails.firstName }} te verzamelen en te verwerken (o.a. voor medische steekkaart) zoals staat vermeld in het privacybeleid.
                    </Checkbox>
                </template>

                <Checkbox v-if="shouldAsk(LegacyRecordType.PicturePermissions)" v-model="allowPictures" class="long-text">
                    {{ memberDetails.firstName }} mag tijdens de activiteiten worden gefotografeerd voor publicatie op de website en sociale media.
                </Checkbox>
                <Checkbox v-if="(!allowPictures || !shouldAsk(LegacyRecordType.PicturePermissions)) && shouldAsk(LegacyRecordType.GroupPicturePermissions)" v-model="allowGroupPictures" class="long-text">
                    Ik geef wel toestemming voor de publicatie van groepsfoto's met {{ memberDetails.firstName }} voor publicatie op de website en sociale media.
                </Checkbox>

                <hr v-if="!allowData && dataRequired">
                <p v-if="!allowData && dataRequired" class="warning-box">
                    Er werd geen toestemming gegeven voor het verzamelen van gevoelige gegevens. Je kan daarom de steekkaart niet invullen.
                </p>
            </template>

            <template v-if="allowData">
                <template v-if="shouldAsk(LegacyRecordType.FinancialProblems)">
                    <hr>
                    <h2>Kansarm gezin</h2>
                    <RecordCheckbox v-model="records" :type="LegacyRecordType.FinancialProblems" />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.FoodAllergies, LegacyRecordType.MedicineAllergies, LegacyRecordType.HayFever, LegacyRecordType.OtherAllergies)">
                    <hr>
                    <h2>Allergieën</h2>

                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.FoodAllergies)" v-model="records" :type="LegacyRecordType.FoodAllergies" placeholder="Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.MedicineAllergies)" v-model="records" :type="LegacyRecordType.MedicineAllergies" placeholder="Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.HayFever)" v-model="records" :type="LegacyRecordType.HayFever" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.OtherAllergies)" v-model="records" :type="LegacyRecordType.OtherAllergies" placeholder="Som hier op welke zaken" />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.Vegetarian, LegacyRecordType.Vegan, LegacyRecordType.Halal, LegacyRecordType.Kosher, LegacyRecordType.Diet)">
                    <hr>
                    <h2>Dieet</h2>

                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Vegetarian)" v-model="records" :type="LegacyRecordType.Vegetarian" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Vegan)" v-model="records" :type="LegacyRecordType.Vegan" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Halal)" v-model="records" :type="LegacyRecordType.Halal" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Kosher)" v-model="records" :type="LegacyRecordType.Kosher" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Diet)" v-model="records" name="Ander dieet" :type="LegacyRecordType.Diet" placeholder="Beschrijving van ander soort dieet. Let op, allergieën hoef je hier niet nog eens te vermelden." />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.CovidHighRisk, LegacyRecordType.Asthma, LegacyRecordType.BedWaters, LegacyRecordType.Epilepsy, LegacyRecordType.HeartDisease, LegacyRecordType.SkinCondition, LegacyRecordType.Rheumatism, LegacyRecordType.SleepWalking, LegacyRecordType.Diabetes, LegacyRecordType.Medicines, LegacyRecordType.SpecialHealthCare)">
                    <hr>
                    <h2>Gezondheid, hygiëne &amp; slapen</h2>

                    <RecordCheckbox v-for="type in [LegacyRecordType.CovidHighRisk, LegacyRecordType.Asthma, LegacyRecordType.BedWaters, LegacyRecordType.Epilepsy, LegacyRecordType.HeartDisease, LegacyRecordType.SkinCondition, LegacyRecordType.Rheumatism, LegacyRecordType.SleepWalking, LegacyRecordType.Diabetes ]" v-if="shouldAsk(type)" :key="type" v-model="records" :type="type" :comments="true" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.Medicines)" v-model="records" :type="LegacyRecordType.Medicines" placeholder="Welke, wanneer en hoe vaak?" comment="Gelieve ons ook de noodzakelijke doktersattesten te bezorgen." />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.SpecialHealthCare)" v-model="records" :type="LegacyRecordType.SpecialHealthCare" placeholder="Welke?" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.SpecialHealthCare)" v-model="records" :type="LegacyRecordType.SpecialHealthCare" placeholder="Welke?" />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.TetanusVaccine)">
                    <hr>
                    <h2>Tetanusvaccinatie (klem)</h2>
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.TetanusVaccine)" v-model="records" :small="true" :name="memberDetails.firstName+' is gevaccineerd tegen tetanus/klem in de afgelopen 10 jaar'" :type="LegacyRecordType.TetanusVaccine" placeholder="In welk jaar?" />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.CanNotSwim, LegacyRecordType.TiredQuickly, LegacyRecordType.CanNotParticipateInSport, LegacyRecordType.SpecialSocialCare)">
                    <hr>
                    <h2>Sport, spel &amp; sociale omgang</h2>

                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.CanNotSwim)" v-model="records" :type="LegacyRecordType.CanNotSwim" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.TiredQuickly)" v-model="records" :type="LegacyRecordType.TiredQuickly" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.CanNotParticipateInSport)" v-model="records" :type="LegacyRecordType.CanNotParticipateInSport" placeholder="Meer informatie" />
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.SpecialSocialCare)" v-model="records" :type="LegacyRecordType.SpecialSocialCare" placeholder="Meer informatie" />
                </template>

                <template v-if="shouldAsk(LegacyRecordType.Other)">
                    <hr>
                    <h2>Andere inlichtingen</h2>
                    <textarea v-model="otherDescription" class="input" placeholder="Enkel invullen indien van toepassing" />
                </template>

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
                            <PhoneInput v-model="doctorPhone" title="Telefoonnummer huisarts" :validator="validator" placeholder="Telefoonnummer" :required="false" />
                        </div>
                    </div>
                </template>
            </template>

            <template v-if="(memberDetails.age !== null && memberDetails.age < 18) && shouldAsk(LegacyRecordType.MedicinePermissions)">
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
        </main>
    </form>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, RecordCheckbox, Slider, STErrorsDefault, STInputBox, Toast,Validator } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { AskRequirement, EmergencyContact, LegacyRecord, LegacyRecordType, Version } from "@stamhoofd/structures"
import { MemberDetails } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';

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
        LoadingButton,
        RecordCheckbox
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

    get doctorRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.doctor === AskRequirement.Required
    }

    get doctorOptional() {
        return OrganizationManager.organization.meta.recordsConfiguration.doctor === AskRequirement.Optional
    }

    shouldAsk(...types: LegacyRecordType[]) {
        return OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(...types)
    }

    get dataRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.needsData()
    }

    get LegacyRecordType() {
        return LegacyRecordType
    }

    showPrivacyWarning() {
        new Toast("Maak niet zomaar wijzigingen aan toestemmingen. Zorg dat je altijd schriftelijk bewijs hebt. Aan deze wijziging werd jouw gebruikers-ID gekoppeld.", "error red").setHide(15*1000).show()
    }

    get allowData() { return this.getBooleanType(LegacyRecordType.DataPermissions) }
    set allowData(enabled: boolean) { 
        this.setBooleanType(LegacyRecordType.DataPermissions, enabled) 
        if (enabled) ( this.showPrivacyWarning() )
    }
    
    get allowPictures() { return this.getBooleanType(LegacyRecordType.PicturePermissions) }
    set allowPictures(enabled: boolean) { 
        this.setBooleanType(LegacyRecordType.PicturePermissions, enabled) 
        if (enabled) ( this.showPrivacyWarning() )
    }

    get allowGroupPictures() { return this.getBooleanType(LegacyRecordType.GroupPicturePermissions) }
    set allowGroupPictures(enabled: boolean) { 
        this.setBooleanType(LegacyRecordType.GroupPicturePermissions, enabled)
        if (enabled) ( this.showPrivacyWarning() )
    }

    get allowMedicines() { return this.getBooleanType(LegacyRecordType.MedicinePermissions) }
    set allowMedicines(enabled: boolean) { 
        this.setBooleanType(LegacyRecordType.MedicinePermissions, enabled)
        if (enabled) ( this.showPrivacyWarning() )
    }

    get otherDescription() { return this.getTypeDescription(LegacyRecordType.Other) }
    set otherDescription(description: string) { 
        if (description.length > 0) { 
            this.setBooleanType(LegacyRecordType.Other, true, description)
            this.setTypeDescription(LegacyRecordType.Other, description) 
        } else {
            this.setBooleanType(LegacyRecordType.Other, false)
        }
    }

    //

    get records() {
        return this.memberDetails.records
    }

    set records(records: LegacyRecord[]) {
        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        memberDetails.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(records)

        this.$emit("change", memberDetails)
    }

    // Helpers ---

    getBooleanType(type: LegacyRecordType) {
        return !!this.memberDetails.records.find(r => r.type == type)
    }

    setBooleanType(type: LegacyRecordType, enabled: boolean, description = "") {
        const index = this.memberDetails.records.findIndex(r => r.type == type)
        if ((index != -1) === enabled) {
            return
        }

        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)

        if (enabled) {
            memberDetails.records.push(LegacyRecord.create({
                type,
                description,
                author: SessionManager.currentSession?.user?.id ?? ""
            }))
        } else {
            memberDetails.records.splice(index, 1)
        }
        memberDetails.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(memberDetails.records)
        this.$emit("change", memberDetails)
    }

    getTypeDescription(type: LegacyRecordType) {
        const record = this.memberDetails.records.find(r => r.type == type)
        if (!record) {
            return ""
        }
        return record.description
    }

    setTypeDescription(type: LegacyRecordType, description: string) {
        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        const record = memberDetails.records.find(r => r.type === type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }

        record.description = description
        record.author = SessionManager.currentSession?.user?.id ?? ""
        this.$emit("change", memberDetails)
    }
}
</script>