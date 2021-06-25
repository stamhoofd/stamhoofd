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

            <template v-if="shouldAsk(RecordType.DataPermissions, RecordType.PicturePermissions, RecordType.GroupPicturePermissions)">
                <hr>
                <h2>Privacy</h2>

                <template v-if="shouldAsk(RecordType.DataPermissions)">
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

                <Checkbox v-if="shouldAsk(RecordType.PicturePermissions)" v-model="allowPictures" class="long-text">
                    {{ details.firstName }} mag tijdens de activiteiten worden gefotografeerd voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>
                <Checkbox v-if="(!allowPictures || !shouldAsk(RecordType.PicturePermissions)) && shouldAsk(RecordType.GroupPicturePermissions)" v-model="allowGroupPictures" class="long-text">
                    Ik geef wel toestemming voor de publicatie van groepsfoto's met {{ details.firstName }} voor publicatie op de website en sociale media van {{ organization.name }}.
                </Checkbox>

                <p v-if="!allowData && dataRequired" class="warning-box">
                    Je bent vrij om geen gevoelige gegevens in te vullen, maar dan aanvaard je uiteraard ook de risico's die ontstaan doordat {{ organization.name }} geen weet heeft van belangrijke zaken en daar niet juist op kan reageren in bepaalde situaties (bv. allergisch voor bepaalde stof).
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
                    <RecordCheckbox v-if="shouldAsk(RecordType.Diet)" v-model="records" name="Ander dieet" :type="RecordType.Diet" placeholder="Beschrijving van ander soort dieet. Let op, allergieën hoef je hier niet nog eens te vermelden." />
                </template>

                <template v-if="shouldAsk(RecordType.CovidHighRisk, RecordType.Asthma, RecordType.BedWaters, RecordType.Epilepsy, RecordType.HeartDisease, RecordType.SkinCondition, RecordType.Rheumatism, RecordType.SleepWalking, RecordType.Diabetes, RecordType.Medicines, RecordType.SpecialHealthCare)">
                    <hr>
                    <h2>Gezondheid, hygiëne &amp; slapen</h2>

                    <RecordCheckbox v-for="type in [RecordType.CovidHighRisk, RecordType.Asthma, RecordType.BedWaters, RecordType.Epilepsy, RecordType.HeartDisease, RecordType.SkinCondition, RecordType.Rheumatism, RecordType.SleepWalking, RecordType.Diabetes ]" v-if="shouldAsk(type)" :key="type" v-model="records" :type="type" :comments="true" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.Medicines)" v-model="records" :type="RecordType.Medicines" placeholder="Welke, wanneer en hoe vaak?" comment="Gelieve ons ook de noodzakelijke doktersattesten te bezorgen." />
                    <RecordCheckbox v-if="shouldAsk(RecordType.SpecialHealthCare)" v-model="records" :type="RecordType.SpecialHealthCare" placeholder="Welke?" />
                </template>

                <template v-if="shouldAsk(RecordType.TetanusVaccine)">
                    <hr>
                    <h2>Tetanusvaccinatie (klem)</h2>
                    <RecordCheckbox v-if="shouldAsk(RecordType.TetanusVaccine)" v-model="records" :small="true" :name="details.firstName+' is gevaccineerd tegen tetanus/klem in de afgelopen 10 jaar'" :type="RecordType.TetanusVaccine" placeholder="In welk jaar?" />
                </template>

                <template v-if="shouldAsk(RecordType.CanNotSwim, RecordType.TiredQuickly, RecordType.CanNotParticipateInSport, RecordType.SpecialSocialCare)">
                    <hr>
                    <h2>Sport, spel &amp; sociale omgang</h2>

                    <RecordCheckbox v-if="shouldAsk(RecordType.CanNotSwim)" v-model="records" :type="RecordType.CanNotSwim" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.TiredQuickly)" v-model="records" :type="RecordType.TiredQuickly" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.CanNotParticipateInSport)" v-model="records" :type="RecordType.CanNotParticipateInSport" placeholder="Meer informatie" />
                    <RecordCheckbox v-if="shouldAsk(RecordType.SpecialSocialCare)" v-model="records" :type="RecordType.SpecialSocialCare" placeholder="Meer informatie" />
                </template>

                <template v-if="shouldAsk(RecordType.Other)">
                    <hr>
                    <h2>Andere inlichtingen</h2>
                    <textarea v-model="otherDescription" class="input" placeholder="Enkel invullen indien van toepassing" />
                </template>
            </template>

            <template v-if="(details.age !== null && details.age < 18) && shouldAsk(RecordType.MedicinePermissions)">
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
import { AskRequirement, EmergencyContact,MemberDetails, Record, RecordType, Version } from "@stamhoofd/structures"
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

    shouldAsk(...types: RecordType[]) {
        return OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(...types)
    }

    get dataRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.needsData()
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
                this.details.records = this.details.records.filter(r => r.type == RecordType.PicturePermissions || r.type == RecordType.GroupPicturePermissions || r.type == RecordType.MedicinePermissions )
                this.details.doctor = null
            }

            // Filter records (remove records that were disabled and might be already saved somehow)
            this.details.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(this.details.records)

            if (!this.details.age || this.details.age >= 18) {
                // remove medicine permission (not needed any longer)
                this.details.records = this.details.records.filter(r => r.type !== RecordType.MedicinePermissions)
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

    get allowData() { return this.getBooleanType(RecordType.DataPermissions) }
    set allowData(enabled: boolean) { this.setBooleanType(RecordType.DataPermissions, enabled) }
    
    get allowPictures() { return this.getBooleanType(RecordType.PicturePermissions) }
    set allowPictures(enabled: boolean) { this.setBooleanType(RecordType.PicturePermissions, enabled) }

    get allowGroupPictures() { return this.getBooleanType(RecordType.GroupPicturePermissions) }
    set allowGroupPictures(enabled: boolean) { this.setBooleanType(RecordType.GroupPicturePermissions, enabled) }

    get allowMedicines() { return this.getBooleanType(RecordType.MedicinePermissions) }
    set allowMedicines(enabled: boolean) { this.setBooleanType(RecordType.MedicinePermissions, enabled) }
   
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
        return !!this.details.records.find(r => r.type == type)
    }

    setBooleanType(type: RecordType, enabled: boolean) {
        const index = this.details.records.findIndex(r => r.type == type)
        if ((index != -1) === enabled) {
            return
        }
        if (enabled) {
            this.details.records.push(Record.create({
                type,
            }))
        } else {
            this.details.records.splice(index, 1)
        }
    }

    get records() {
        return this.details.records
    }

    set records(records: Record[]) {
        this.details.records = records
    }

    getTypeDescription(type: RecordType) {
        const record = this.details.records.find(r => r.type == type)
        if (!record) {
            return ""
        }
        return record.description
    }

    setTypeDescription(type: RecordType, description: string) {
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