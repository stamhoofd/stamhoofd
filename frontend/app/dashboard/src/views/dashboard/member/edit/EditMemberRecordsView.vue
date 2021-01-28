<template>
    <form id="member-records-view" class="view" @submit.prevent="goNext">
        <main>
            <STErrorsDefault :error-box="errorBox" />
            <p v-if="!allowData" class="warning-box">
                Er werd geen toestemming gegeven voor het verzamelen van gevoelige gegevens. Je kan daarom de steekkaart niet invullen. De toestemming kan gewijzigd worden door het lid door in te loggen en de steekkaart te wijzigen.
            </p>

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
        </main>
    </form>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, RecordCheckbox, Validator } from "@stamhoofd/components"
import { AskRequirement, EmergencyContact, Record, RecordType, Version } from "@stamhoofd/structures"
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

    shouldAsk(...types: RecordType[]) {
        return OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(...types)
    }

    get dataRequired() {
        return OrganizationManager.organization.meta.recordsConfiguration.needsData()
    }

    get RecordType() {
        return RecordType
    }

    get allowData() { return this.getBooleanType(RecordType.DataPermissions) }
    set allowData(enabled: boolean) { this.setBooleanType(RecordType.DataPermissions, enabled) }

    get otherDescription() { return this.getTypeDescription(RecordType.Other) }
    set otherDescription(description: string) { 
        if (description.length > 0) { 
            this.setBooleanType(RecordType.Other, true, description)
            this.setTypeDescription(RecordType.Other, description) 
        } else {
            this.setBooleanType(RecordType.Other, false)
        }
    }

    //

    get records() {
        return this.memberDetails.records
    }

    set records(records: Record[]) {
        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        memberDetails.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(records)

        this.$emit("change", memberDetails)
    }

    // Helpers ---

    getBooleanType(type: RecordType) {
        return !!this.memberDetails.records.find(r => r.type == type)
    }

    setBooleanType(type: RecordType, enabled: boolean, description: string = "") {
        const index = this.memberDetails.records.findIndex(r => r.type == type)
        if ((index != -1) === enabled) {
            return
        }

        const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)

        if (enabled) {
            memberDetails.records.push(Record.create({
                type,
                description
            }))
        } else {
            memberDetails.records.splice(index, 1)
        }
        memberDetails.records = OrganizationManager.organization.meta.recordsConfiguration.filterRecords(memberDetails.records)
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
        const record = memberDetails.records.find(r => r.type === type)
        if (!record) {
            console.error("Tried to set description for record that doesn't exist")
            return
        }

        record.description = description
        this.$emit("change", memberDetails)
    }
}
</script>