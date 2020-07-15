<template>
    <div id="member-general-view" class="st-view">
        <STNavigationBar title="Ouders">
            <button slot="left" class="button icon gray left arrow-left" @click="pop">Terug</button>
        </STNavigationBar>
        
        <main>
            <h1>
                Ouders van {{ member.firstName }}
            </h1>

            <p>Voeg alle ouders van {{ member.firstName }} toe. Deze kunnen we contacteren in noodgevallen, maar kunnen ook de gegevens tijdens het jaar wijzigen.</p>
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
import { Address, Country, Organization, OrganizationMetaData, OrganizationType, Gender, MemberDetails } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";

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
export default class MemberParentsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    member: MemberDetails

    
    async goNext() {
        // todo
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

#member-parents-view {
}
</style>
