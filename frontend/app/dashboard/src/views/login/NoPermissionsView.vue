<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Deze pagina is voor beheerders</h1>
                <p>Oeps, deze pagina is enkel voor beheerders van {{ organization.name }}. Je hebt een uitnodiging nodig om beheerder te worden.</p>                
            </main>

            <STToolbar>
                <button slot="right" class="primary button" @click="gotoRegistration">
                    <span>Naar inschrijvingspagina</span>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, ErrorBox,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Group, MemberWithRegistrations, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Vue } from "vue-property-decorator";

import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import MemberGroupView from '../registration/MemberGroupView.vue';
import FinancialProblemsView from './FinancialProblemsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
    }
})
export default class NoPermissionsView extends Mixins(NavigationMixin){

    get organization() {
        return OrganizationManager.organization
    }

    gotoRegistration() {
        if (this.organization.registerDomain) {
            window.location.href = "https://"+this.organization.registerDomain
        } else {
            window.location.href = "https://"+this.organization.uri+"."+process.env.HOSTNAME_REGISTRATION
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>