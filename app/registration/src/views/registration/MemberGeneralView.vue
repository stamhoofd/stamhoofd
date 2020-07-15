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

                    <AddressInput title="Adres van dit lid" v-model="address" />

                    <STInputBox title="Geboortedatum" error-fields="birthDate" :error-box="errorBox">
                        <BirthDateInput v-model="birthDate" />
                    </STInputBox>
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
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, BirthDateInput, AddressInput } from "@stamhoofd/components"
import { Address, Country, Organization, OrganizationMetaData, OrganizationType} from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        AddressInput,
        BirthDateInput
    }
})
export default class MemberGeneralView extends Mixins(NavigationMixin) {
    firstName = ""
    lastName = ""
    errorBox: ErrorBox | null = null

    // todo: replace with Addres and new input component
    address: Address | null = null
    birthDate = new Date()

    goNext() {

        
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#member-general-view {
}
</style>
