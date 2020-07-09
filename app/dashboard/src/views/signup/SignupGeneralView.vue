<template>
    <div id="signup-general-view" class="st-view">
        <STNavigationBar title="Jouw vereniging aansluiten">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">
                Terug
            </button>
        </STNavigationBar>
        <STNavigationTitle>
            Jouw vereniging aansluiten
        </STNavigationTitle>

        <main>
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

                    <STInputBox title="Adres van je vereniging" error-fields="address" :error-box="errorBox">
                        <input v-model="addressLine1" class="input" type="text" placeholder="Straat en number" autocomplete="address-line1">
                        <div class="input-group">
                            <div>
                                <input v-model="postalCode" class="input" type="text" placeholder="Postcode" autocomplete="postal-code">
                            </div>
                            <div>
                                <input v-model="city" class="input" type="text" placeholder="Gemeente" autocomplete="city">
                            </div>
                        </div>

                        <select v-model="country" class="input">
                            <option value="BE">
                                België
                            </option>
                            <option value="NL">
                                Nederland
                            </option>
                        </select>
                    </STInputBox>
                </div>

                <STInputBox title="Hoeveel leden hebben jullie ongeveer?" error-fields="expectedMemberCount" :error-box="errorBox">
                    <Slider v-model="expectedMemberCount" :max="500" :min="0" />
                </STInputBox>
            </div>
        </main>

        <STToolbar>
            <template #left>
                Volledig gratis tot je de demo beïndigd
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
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox } from "@stamhoofd/components/src/errors/ErrorBox";
import STErrorsDefault from "@stamhoofd/components/src/errors/STErrorsDefault.vue";
import Slider from "@stamhoofd/components/src/inputs/Slider.vue"
import STInputBox from "@stamhoofd/components/src/inputs/STInputBox.vue";
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/components/src/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/components/src/navigation/STToolbar.vue"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType} from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import SignupStructureView from './SignupStructureView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle,
        Slider,
        STErrorsDefault,
        STInputBox
    }
})
export default class SignupGeneralView extends Mixins(NavigationMixin) {
    name = ""
    errorBox: ErrorBox | null = null

    addressLine1 = ""
    street = ""
    city = ""
    postalCode = ""
    country: Country = "BE"
    expectedMemberCount = 150

    mounted() {
        const server = new Server("http://localhost:9090")

        server.request({
            method: "GET",
            path: "/status",
        }).then(data => {
            console.log(data)
        }).catch(e => {
            console.error(e)
        });
    }

    goNext() {

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

            let address: Address

            try {
                address = Address.createFromFields(this.addressLine1, this.postalCode, this.city, this.country)
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace("address")
                }
                throw e;
            }
            

            const organization = Organization.create({
                name: this.name,
                meta: OrganizationMetaData.create({
                    type: OrganizationType.Other,
                    expectedMemberCount: this.expectedMemberCount
                }),
                address: address,
                publicKey: "" // placeholder
            })

            this.errorBox = null

            this.show(new ComponentWithProperties(SignupStructureView, { organization }))
        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                console.log("Updated errorbox")
                this.errorBox = new ErrorBox(e)
            }
            return;
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#signup-general-view {
}
</style>
