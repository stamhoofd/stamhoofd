<template>
    <div id="member-general-view" class="st-view">
        <STNavigationBar title="Inschrijven">
            <button slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        
        <main>
            <h1>
                Wie ga je inschrijven?
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

                    <PhoneInput title="GSM-nummer van dit lid" v-model="phone" :validator="validator" :required="age >= 18" :placeholder="age >= 18 ? 'Enkel van lid zelf': 'Optioneel. Enkel van lid zelf'" v-if="age >= 12"/>


                </div>
            </div>
        </main>

        <STToolbar>
            <button  slot="right" class="button primary" @click="goNext">
                Volgende
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BirthDayInput, AddressInput, RadioGroup, Radio, PhoneInput, Checkbox, Validator } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";
import { MemberDetails } from '@stamhoofd/structures';
import MemberParentsView from './MemberParentsView.vue';

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
        Checkbox
    }
})
export default class MemberGeneralView extends Mixins(NavigationMixin) {
    firstName = ""
    lastName = ""
    phone: string | null = null
    errorBox: ErrorBox | null = null

    // todo: replace with Addres and new input component
    address: Address | null = null
    birthDay: Date | null = null
    gender = Gender.Male
    livesAtParents = false
    validator = new Validator()

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
            const memberDetails = MemberDetails.create({
                firstName: this.firstName,
                lastName: this.lastName,
                gender: this.gender,
                phone: this.phone,
                mail: null,
                birthDay: this.birthDay!,
                address: this.address
            })

            // todo: Get possible groups

            // todo: check age before asking parents

            this.show(new ComponentWithProperties(MemberParentsView, { member: memberDetails }))
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#member-general-view {
}
</style>
