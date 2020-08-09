<template>
    <div id="signup-general-view" class="st-view">
        <STNavigationBar title="Jouw vereniging aansluiten">
            <button slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        

        <main>
            <h1>
                Jouw vereniging aansluiten
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van je vereniging" error-fields="name" :error-box="errorBox">
                        <input
                            id="organization-name"
                            ref="firstInput"
                            v-model="name"
                            class="input"
                            type="text"
                            placeholder="De naam van je vereniging"
                            autocomplete="organization"
                        >
                    </STInputBox>

                    <AddressInput title="Adres van je vereniging" v-model="address" :validator="validator"/>
                </div>

                <STInputBox title="Hoeveel leden hebben jullie ongeveer?" error-fields="expectedMemberCount" :error-box="errorBox">
                    <Slider v-model="expectedMemberCount" :max="500" :min="0" />
                </STInputBox>
            </div>
        </main>

        <STToolbar>
            <template #left>
                Volledig gratis tot je de demo beëindigd
            </template>
            <template #right>
                <button class="button primary" @click="goNext">
                    Volgende
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin, HistoryManager } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BackButton, Validator, AddressInput } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType} from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import SignupStructureView from './SignupStructureView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        BackButton,
        AddressInput
    }
})
export default class SignupGeneralView extends Mixins(NavigationMixin) {
    name = ""
    validator = new Validator()
    errorBox: ErrorBox | null = null
    expectedMemberCount = 150
    address: Address | null = null

    mounted() {
        HistoryManager.setUrl("/aansluiten")
    }

    async goNext() {
        try {
            if (this.name.length == 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "Vul de naam van je vereniging in",
                    field: "name"
                })
            }
            if (this.name.length < 3) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "De naam van je vereniging is te kort",
                     field: "name"
                })
            }

            this.errorBox = null

            if (!await this.validator.validate() || !this.address) {
                return
            }

            const defaultStartDate = new Date()
            defaultStartDate.setMonth(defaultStartDate.getMonth() + 1)
            defaultStartDate.setDate(1)

            const defaultEndDate = new Date(defaultStartDate.getTime())
            defaultEndDate.setFullYear(defaultStartDate.getFullYear() + 1)

            const organization = Organization.create({
                name: this.name,
                uri: "", // ignored by backend for now
                meta: OrganizationMetaData.create({
                    type: OrganizationType.Other,
                    expectedMemberCount: this.expectedMemberCount,
                    defaultStartDate,
                    defaultEndDate
                }),
                address: this.address,
                publicKey: "" // placeholder
            })

            this.errorBox = null

            this.show(new ComponentWithProperties(SignupStructureView, { organization }))
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            return;
        }
    }

    shouldNavigateAway() {
        if (confirm("Ben je zeker dat je dit venster wilt sluiten?")) {
            plausible('closeSignup');
            return true;
        }
        plausible('cancelCloseSignup');
        return false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-general-view {
}
</style>
