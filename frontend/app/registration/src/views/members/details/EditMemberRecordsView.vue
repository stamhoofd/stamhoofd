<template>
    <div id="member-records-view" class="st-view">
        <STNavigationBar title="Steekkaart">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" type="button" @click="dismiss" />
        </STNavigationBar>
        
        <main>
            <h1>
                Persoonlijke steekkaart van {{ details.firstName }}<span v-tooltip="'Net zoals alle gegevens zijn deze versleuteld opgeslagen en is de toegang op een cryptografische manier vastgelegd.'" class="icon gray privacy middle" />
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <template v-if="shouldAsk(LegacyRecordType.DataPermissions, LegacyRecordType.PicturePermissions, LegacyRecordType.GroupPicturePermissions)">
                <hr>
                <h2>Privacy</h2>

                <template v-if="shouldAsk(LegacyRecordType.DataPermissions)">
                    <Checkbox v-if="privacyUrl" v-model="allowData" class="long-text">
                        Ik geef toestemming aan {{ organization.name }} om de gevoelige gegevens van {{ details.firstName }} te verzamelen en te verwerken (o.a. voor medische steekkaart). Hoe we met deze gegevens omgaan staat vermeld in <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
                    </Checkbox>
                    <Checkbox v-else v-model="allowData" class="long-text">
                        Ik geef toestemming aan {{ organization.name }} om de gevoelige gegevens van {{ details.firstName }} te verzamelen en te verwerken (o.a. voor medische steekkaart).
                    </Checkbox>
                    <Checkbox v-if="allowData && details.age && details.age < 18" v-model="isParent" class="long-text">
                        Ik ben wettelijke voogd of ouder van {{ details.firstName }} en mag deze toestemming geven.
                    </Checkbox>
                </template>

                <Checkbox v-if="shouldAsk(LegacyRecordType.PicturePermissions)" v-model="allowPictures" class="long-text">
                    {{ details.firstName }} mag tijdens de activiteiten worden gefotografeerd voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>
                <Checkbox v-if="(!allowPictures || !shouldAsk(LegacyRecordType.PicturePermissions)) && shouldAsk(LegacyRecordType.GroupPicturePermissions)" v-model="allowGroupPictures" class="long-text">
                    Ik geef wel toestemming voor de publicatie van groepsfoto's met {{ details.firstName }} voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>

                <p v-if="!allowData && dataRequired" class="warning-box">
                    Je bent vrij om geen gevoelige gegevens in te vullen, maar dan aanvaard je uiteraard ook de risico's die ontstaan doordat {{ organization.name }} geen weet heeft van belangrijke zaken en daar niet juist op kan reageren in bepaalde situaties (bv. allergisch voor bepaalde stof).
                </p>
            </template>

            <template v-if="allowData">
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
                </template>

                <template v-if="shouldAsk(LegacyRecordType.TetanusVaccine)">
                    <hr>
                    <h2>Tetanusvaccinatie (klem)</h2>
                    <RecordCheckbox v-if="shouldAsk(LegacyRecordType.TetanusVaccine)" v-model="records" :small="true" :name="details.firstName+' is gevaccineerd tegen tetanus/klem in de afgelopen 10 jaar'" :type="LegacyRecordType.TetanusVaccine" placeholder="In welk jaar?" />
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
            </template>

            <template v-if="(details.age !== null && details.age < 18) && shouldAsk(LegacyRecordType.MedicinePermissions)">
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
                    {{ nextText }}
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton,PhoneInput, RecordCheckbox,STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, TooltipDirective as Tooltip, Validator } from "@stamhoofd/components"
import { AskRequirement, EmergencyContact,LegacyRecordType, MemberDetails, LegacyRecord, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

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
export default class EditMemberRecordsView extends Mixins(NavigationMixin) {
    loading = false

    @Prop({ required: true })
    isNew: boolean

    @Prop({ required: true })
    details: MemberDetails

    @Prop({ required: true })
    saveHandler: (details: MemberDetails, component: NavigationMixin) => Promise<void>

    @Prop({ required: true })
    nextText: string

    organization = OrganizationManager.organization

    validator = new Validator()
    errorBox: ErrorBox | null = null

    doctorName = ""
    doctorPhone: string | null = null

    isParent = false

    mounted() {
        if ((this.details.age ?? 99) < 18 && this.details.reviewTimes.getLastReview("records") !== undefined) {
            // already accepted previous time
            this.isParent = true
        }

        if (this.details) {
            this.doctorName = this.details.doctor?.name ?? ""
            this.doctorPhone = this.details.doctor?.phone ?? ""
        }

        if (!this.details || !this.details.doctor) {
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

    shouldAsk(...types: LegacyRecordType[]) {
        return OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(...types)
    }

    get dataRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.needsData()
    }

    get LegacyRecordType() {
        return LegacyRecordType
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
        this.loading = true

        try {
            if (this.allowData) {
                const errors = new SimpleErrors()
                if (this.doctorRequired && this.doctorName.length < 2) {
                    errors.addError(new SimpleError({
                        code: "invalid_field",
                        message: "Vul de naam van de dokter in",
                        field: "doctorName"
                    }))
                }

                if ((this.details.age ?? 99) < 18 && !this.isParent) {
                    // already accepted previous time
                    errors.addError(new SimpleError({
                        code: "invalid_field",
                        message: "Enkel een voogd of ouder kan toestemming geven voor het verwerken van gevoelige gegevens.",
                        field: "allowData"
                    }))
                }

                const valid = await this.validator.validate()

                if (!valid || errors.errors.length > 0) {
                    if (errors.errors.length > 0) {
                        this.errorBox = new ErrorBox(errors)
                    }
                    this.loading = false
                    return;
                }

                if (this.doctorRequired || (this.doctorOptional && (this.doctorName.length > 0 || (this.doctorPhone?.length ?? 0) > 0))) {
                    this.details.doctor = EmergencyContact.create({
                        name: this.doctorName,
                        phone: this.doctorPhone,
                        title: "Huisdokter"
                    })
                } else {
                    this.details.doctor = null
                }

                
            } else {
                // Remove all records except...
                this.details.records = this.details.records.filter(r => r.type == LegacyRecordType.PicturePermissions || r.type == LegacyRecordType.GroupPicturePermissions || r.type == LegacyRecordType.MedicinePermissions )
                this.details.doctor = null
            }

            // Filter records (remove records that were disabled and might be already saved somehow)
            this.details.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(this.details.records)

            if (!this.details.age || this.details.age >= 18) {
                // remove medicine permission (not needed any longer)
                this.details.records = this.details.records.filter(r => r.type !== LegacyRecordType.MedicinePermissions)
            }
        } catch (e) {
            console.error(e);
            this.loading = false
            this.errorBox = new ErrorBox(e)
            return
        }

        try {
            this.details.reviewTimes.markReviewed("records")
            await this.saveHandler(this.details, this)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    get allowData() { return this.getBooleanType(LegacyRecordType.DataPermissions) }
    set allowData(enabled: boolean) { this.setBooleanType(LegacyRecordType.DataPermissions, enabled) }
    
    get allowPictures() { return this.getBooleanType(LegacyRecordType.PicturePermissions) }
    set allowPictures(enabled: boolean) { this.setBooleanType(LegacyRecordType.PicturePermissions, enabled) }

    get allowGroupPictures() { return this.getBooleanType(LegacyRecordType.GroupPicturePermissions) }
    set allowGroupPictures(enabled: boolean) { this.setBooleanType(LegacyRecordType.GroupPicturePermissions, enabled) }

    get allowMedicines() { return this.getBooleanType(LegacyRecordType.MedicinePermissions) }
    set allowMedicines(enabled: boolean) { this.setBooleanType(LegacyRecordType.MedicinePermissions, enabled) }
   
    get otherDescription() { return this.getTypeDescription(LegacyRecordType.Other) }
    set otherDescription(description: string) { 
        if (description.length > 0) { 
            this.setBooleanType(LegacyRecordType.Other, true)
            this.setTypeDescription(LegacyRecordType.Other, description) 
        } else {
            this.setBooleanType(LegacyRecordType.Other, false)
        }
    }

    // Helpers ---

    getBooleanType(type: LegacyRecordType) {
        return !!this.details.records.find(r => r.type == type)
    }

    setBooleanType(type: LegacyRecordType, enabled: boolean) {
        const index = this.details.records.findIndex(r => r.type == type)
        if ((index != -1) === enabled) {
            return
        }
        if (enabled) {
            this.details.records.push(LegacyRecord.create({
                type,
            }))
        } else {
            this.details.records.splice(index, 1)
        }
    }

    get records() {
        return this.details.records
    }

    set records(records: LegacyRecord[]) {
        this.details.records = records
    }

    getTypeDescription(type: LegacyRecordType) {
        const record = this.details.records.find(r => r.type == type)
        if (!record) {
            return ""
        }
        return record.description
    }

    setTypeDescription(type: LegacyRecordType, description: string) {
        const record = this.details.records.find(r => r.type == type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }
        record.description = description
    }

    @Prop({ required: true })
    originalDetails: MemberDetails

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
}
</script>