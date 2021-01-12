<template>
    <form id="member-general-view" @submit.prevent="goNext">
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

                <BirthDayInput v-model="birthDay" title="Geboortedatum" :validator="validator" />

                <STInputBox title="Identificeert zich als..." error-fields="gender" :error-box="errorBox">
                    <RadioGroup>
                        <Radio v-model="gender" value="Male" autocomplete="sex" name="sex">
                            Man
                        </Radio>
                        <Radio v-model="gender" value="Female" autocomplete="sex" name="sex">
                            Vrouw
                        </Radio>
                        <Radio v-model="gender" value="Other" autocomplete="sex" name="sex">
                            Andere
                        </Radio>
                    </RadioGroup>
                </STInputBox>

                <Checkbox v-if="livesAtParents || (age >= 18 && age <= 27)" v-model="livesAtParents">
                    Woont bij ouders
                </Checkbox>
            </div>

            <div>
                <AddressInput v-if="(age >= 18 && !livesAtParents) || hasOldAddress" v-model="address" title="Adres van dit lid" :validator="validator" :required="false" />
                <EmailInput v-if="age >= 11" v-model="email" title="E-mailadres van dit lid" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" :required="false" :validator="validator" />
                <PhoneInput v-if="age >= 11" v-model="phone" title="GSM-nummer van dit lid" :validator="validator" :required="false" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" />
            </div>
        </div>
    </form>
</template>

<script lang="ts">
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BirthDayInput, Checkbox, EmailInput, ErrorBox, LoadingButton,PhoneInput, Radio, RadioGroup, Slider, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components"
import { Address, Gender, Record, RecordType, Version } from "@stamhoofd/structures"
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
export default class EditMemberGeneralView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    memberDetails!: MemberDetails | null            
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
    hasOldAddress = false

    mounted() {
        if (this.memberDetails) {
            this.firstName = this.memberDetails.firstName
            this.lastName = this.memberDetails.lastName
            this.phone = this.memberDetails.phone
            this.address = this.memberDetails.address
            this.birthDay = this.memberDetails.birthDay
            this.gender = this.memberDetails.gender
            this.livesAtParents = !this.memberDetails.address && this.age >= 18
            this.email = this.memberDetails.email
            this.hasOldAddress = this.address !== null
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

    async validate() {
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
                const memberDetails = new ObjectData(this.memberDetails.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)

                // Keep all that was already chagned in next steps
                memberDetails.firstName = this.firstName
                memberDetails.lastName = this.lastName
                memberDetails.gender = this.gender
                memberDetails.phone = this.phone
                memberDetails.birthDay = this.birthDay!
                memberDetails.email = this.age >= 18 ? this.email : null
                memberDetails.address = this.livesAtParents ? null : this.address

                this.$emit("change", memberDetails)
            } else {
                const memberDetails = MemberDetails.create({
                    firstName: this.firstName,
                    lastName: this.lastName,
                    gender: this.gender,
                    phone: this.phone,
                    email: this.age >= 18 ? this.email : null,
                    birthDay: this.birthDay!,
                    address: this.livesAtParents ? null : this.address
                })

                // Add default values for records
                memberDetails.records.push(Record.create({
                    type: RecordType.NoData
                }))
                memberDetails.records.push(Record.create({
                    type: RecordType.NoPictures
                }))
                if (memberDetails.age < 18) {
                    memberDetails.records.push(Record.create({
                        type: RecordType.NoPermissionForMedicines
                    }))
                }

                this.$emit("change", memberDetails)
            }
            return true;
        }
        return false
    }
}
</script>
