<template>
    <div id="signup-general-view" class="st-view">
        <STNavigationBar title="Stamhoofd gratis uitproberen">
            <button slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>
        

        <main>
            <h1>
                Aan de slag met Stamhoofd
            </h1>
            <p>Een account maken duurt niet lang en is gratis. Je kiest zelf welke functies je gebruikt.</p>

            <STErrorsDefault :error-box="errorBox" />
            <div class="split-inputs">
                <div>
                    <STInputBox title="Naam van jouw vereniging" error-fields="name" :error-box="errorBox">
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

                    <AddressInput v-model="address" title="Adres van je vereniging" :validator="validator" />
                    <p class="style-description-small">Geen adres? Vul dan een adres in dat in de buurt ligt</p>

                    <STInputBox title="Doorverwijzingscode" error-fields="registerCode" :error-box="errorBox" v-if="false">
                        <input
                            v-model="registerCode"
                            class="input"
                            type="text"
                            placeholder="Optioneel"
                            autocomplete="off"
                        >
                    </STInputBox>
                </div>

                <div>
                    <STInputBox title="Soort vereniging" error-fields="type" :error-box="errorBox">
                        <select v-model="type" class="input">
                            <option :value="null" disabled>
                                Maak een keuze
                            </option>
                            <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                                {{ _type.name }}
                            </option>
                        </select>
                    </STInputBox>

                    <STInputBox v-if="type == 'Youth'" title="Koepelorganisatie" error-fields="umbrellaOrganization" :error-box="errorBox">
                        <select v-model="umbrellaOrganization" class="input">
                            <option :value="null" disabled>
                                Maak een keuze
                            </option>
                            <option :value="item.value" v-for="item in availableUmbrellaOrganizations" :key="item.value">
                                {{ item.name }}
                            </option>
                        </select>
                    </STInputBox>
                </div>

                <STInputBox title="Hoeveel leden hebben jullie ongeveer?" error-fields="expectedMemberCount" :error-box="errorBox" v-if="false">
                    <Slider v-model="expectedMemberCount" :max="500" :min="0" />
                </STInputBox>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" @click="goNext">
                        Aan de slag
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, ErrorBox, LoadingButton, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { NetworkManager } from '@stamhoofd/networking';
import { Address, Organization, OrganizationMetaData, OrganizationType, OrganizationTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper} from "@stamhoofd/structures"
import { Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";
import SignupAccountView from './SignupAccountView.vue';

import SignupStructureView from './SignupStructureView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        BackButton,
        AddressInput,
        LoadingButton
    }
})
export default class SignupGeneralView extends Mixins(NavigationMixin) {
    name = ""
    validator = new Validator()
    errorBox: ErrorBox | null = null
    expectedMemberCount = 150
    address: Address | null = null

    @Prop({ default: "" })
    initialRegisterCode!: string;

    registerCode = this.initialRegisterCode
    loading = false

    type: OrganizationType | null = null
    umbrellaOrganization: UmbrellaOrganization | null = null

    mounted() {
        if (this.initialRegisterCode) {
            localStorage.setItem("savedRegisterCode", this.initialRegisterCode)
        }

        if (!this.initialRegisterCode) {
            const saved = localStorage.getItem("savedRegisterCode")
            if (saved !== null) {
                this.registerCode = saved
            }
        }

        if (this.registerCode.length > 0) {
            HistoryManager.setUrl("/aansluiten/"+encodeURIComponent(this.registerCode))
        } else {
            HistoryManager.setUrl("/aansluiten")   
        }
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
            if (this.name.length < 4) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "",
                    human: "De naam van je vereniging is te kort",
                     field: "name"
                })
            }

            if (this.type === null) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "type"
                })
            }

            if (this.umbrellaOrganization === null && this.type == OrganizationType.Youth) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Maak een keuze",
                    field: "umbrellaOrganization"
                })
            }

            this.loading = true;
            this.errorBox = null

            if (!await this.validator.validate() || !this.address) {
                this.loading = false;
                return
            }

            // Check register code
            if (this.registerCode.length > 0) {
                try {
                    const response = await NetworkManager.server.request({
                        method: "GET",
                        path: "/register-code/"+encodeURIComponent(this.registerCode.toUpperCase()),
                    })
                } catch (e) {
                    this.errorBox = new ErrorBox(e)
                    this.loading = false;
                    return;
                }
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
                    type: this.type,
                    umbrellaOrganization: this.umbrellaOrganization,
                    expectedMemberCount: this.expectedMemberCount,
                    defaultStartDate,
                    defaultEndDate
                }),
                address: this.address,
                publicKey: "" // placeholder
            })

            this.loading = false;
            this.errorBox = null
            this.show(new ComponentWithProperties(SignupAccountView, { organization, registerCode: this.registerCode }))
            plausible('signupGeneral');
        } catch (e) {
            this.loading = false;
            console.error(e)
            this.errorBox = new ErrorBox(e)
            plausible('signupGeneralError');
            return;
        }
    }

    get availableTypes() {
        return OrganizationTypeHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        );
    }

    get availableUmbrellaOrganizations() {
        return UmbrellaOrganizationHelper.getList().sort((a, b) => 
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith("andere"), 
                    !b.name.toLowerCase().startsWith("andere")
                ), 
                Sorter.byStringProperty(a, b, "name")
            )
        )
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
