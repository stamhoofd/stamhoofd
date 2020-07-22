<template>
    <div id="member-records-view" class="st-view">
        <STNavigationBar title="Steekkaart">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>
        
        <main>
            <h1>
                Persoonlijke steekkaart van {{ memberDetails.firstName }}<span v-tooltip="'Enkel zichtbaar voor leiding en kookploeg. Net zoals alle gegevens zijn deze versleuteld opgeslagen en is de toegang op een cryptografische manier vastgelegd.'" class="icon gray privacy middle" />
            </h1>

            <hr>
            <h2>Privacy</h2>

            <Checkbox v-model="allowData" class="long-text">
                Ik geef toestemming aan {{ organization.name }} om de gevoelige gegevens van {{ memberDetails.firstName }}, dewelke ik hieronder kan vermelden, te verzamelen en te verwerken. Hoe we met deze gegevens omgaan staat vermeld in <a class="link" href="/privacy/todo" target="_blank">het privacybeleid</a>.
            </Checkbox>
            <Checkbox v-model="isParent" v-if="allowData && memberDetails.age < 18" class="long-text">
                Ik ben wettelijke voogd of ouder van {{ memberDetails.firstName }} en mag deze toestemming geven.
            </Checkbox>
            <Checkbox v-model="allowPictures" class="long-text">
                {{ memberDetails.firstName }} mag tijdens de activiteiten worden gefotografeerd voor publicatie op de website en sociale media van {{ organization.name }}.
            </Checkbox>

            <p v-if="!allowData" class="warning-box">
                Je bent vrij om geen gevoelige gegevens in te vullen, maar dan aanvaard je uiteraard ook de risico's die ontstaan doordat {{ organization.name }} geen weet heeft van belangrijke zaken en daar niet op kan reageren in de juiste situaties (bv. allergisch voor bepaalde stof).
            </p>

            <template v-if="allowData">
                <hr>
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

                <template v-if="memberDetails.age < 18">
                    <hr>
                    <h2>Toedienen van medicatie</h2>

                    <p class="style-description">Het is verboden om als leid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via deze steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp.</p>

                    <Checkbox v-model="allowMedicines">
                        Wij geven toestemming aan de leiding om bij hoogdringendheid aan onze zoon of dochter een dosis via de apotheek vrij verkrijgbare pijnstillende en koortswerende medicatie toe te dienen*
                    </Checkbox>

                    <p class="style-description-small">* gebaseerd op aanbeveling Kind & Gezin 09.12.2009 – Aanpak van koorts / Toedienen van geneesmiddelen in de kinderopvang</p>
                </template>

                <hr>
                <h2>Contactgegevens huisarts</h2>

                <div class="split-inputs">
                    <div>
                        <STInputBox title="Naam huisarts" error-fields="doctorName" :error-box="errorBox">
                            <input v-model="doctorName" class="input" name="doctorName" type="text" placeholder="Huisarts of prakijknaam" autocomplete="name">
                        </STInputBox>
                    </div>

                    <div>
                        <PhoneInput title="Telefoonnummer huisarts" v-model="doctorPhone" :validator="validator" placeholder="Telefoonnummer" />
                    </div>
                </div>

            </template>
        </main>
        <STToolbar>
            <LoadingButton :loading="loading" slot="right">
                <button class="button primary" @click="goNext">
                    Doorgaan
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder,VersionBox } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip, Validator, BackButton, ErrorBox, PhoneInput, LoadingButton } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { SessionManager } from '@stamhoofd/networking';
import { MemberDetails, Record, RecordType, EmergencyContact } from "@stamhoofd/structures"
import { DecryptedMember } from '@stamhoofd/structures';
import { EncryptedMember } from '@stamhoofd/structures';
import { Version } from '@stamhoofd/structures';
import { KeychainItem } from '@stamhoofd/structures';
import { KeychainedResponseDecoder } from '@stamhoofd/structures';
import { PatchMembers } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import { EncryptedMemberWithRegistrations } from '@stamhoofd/structures';
import { MemberManager } from '../../classes/MemberManager';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        PhoneInput,
        LoadingButton
    },
    directives: { Tooltip },
})
export default class MemberRecordsView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    member: DecryptedMember | null
    
    @Prop({ required: true })
    memberDetails: MemberDetails

    organization = OrganizationManager.organization

    validator = new Validator()
    errorBox: ErrorBox | null = null

    doctorName = ""
    doctorPhone: string | null = null

    isParent = false
    loading = false

    mounted() {
        if (this.member && this.memberDetails.age < 18) {
            // already accepted previous time
            this.isParent = true
        }

        if (this.memberDetails) {
            this.doctorName = this.memberDetails.doctor?.name ?? ""
            this.doctorPhone = this.memberDetails.doctor?.phone ?? ""
        }
    }

    async goNext() {
        if (this.loading) {
            return
        }
        this.errorBox =  null;
        const errors = new SimpleErrors()
        if (this.doctorName.length < 2) {
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

        this.memberDetails.doctor = EmergencyContact.create({
            name: this.doctorName,
            phone: this.doctorPhone,
            title: "Huisdokter"
        })

        this.loading = true

        try {
            if (this.member) {
                this.member.details = this.memberDetails
                await MemberManager.patchAllMembers()
            } else {
                await MemberManager.addMember(this.memberDetails)
            }

            this.dismiss({ force: true })
        } catch (e) {
            console.error(e);
            alert("Er ging iets mis...")
        }
    }

    get allowData() { return !this.getBooleanType(RecordType.NoData) }
    set allowData(enabled: boolean) { this.setBooleanType(RecordType.NoData, !enabled) }

    get allowPictures() { return !this.getBooleanType(RecordType.NoPictures) }
    set allowPictures(enabled: boolean) { this.setBooleanType(RecordType.NoPictures, !enabled) }

    get allowMedicines() { return !this.getBooleanType(RecordType.NoPermissionForMedicines) }
    set allowMedicines(enabled: boolean) { this.setBooleanType(RecordType.NoPermissionForMedicines, !enabled) }

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
        > h2{
            @extend .style-title-2;
            padding-bottom: 15px;
        }

        > hr{
            @extend .style-hr;
        }

        > .checkbox + .textarea-container {
            padding-bottom: 20px;
            padding-left: 35px;

            @media (max-width: 400px) {
                padding-left: 0;
            }
        }
    }
}
</style>
