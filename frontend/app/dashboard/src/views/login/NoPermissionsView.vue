<template>
    <div class="boxed-view">
        <div class="st-view">
            <main>
                <h1>Deze pagina is voor beheerders</h1>
                <p>Oeps, deze pagina is enkel voor beheerders van {{ organization.name }}. Je hebt een uitnodiging nodig om beheerder te worden.</p>                
            </main>

             <STToolbar>
                <button class="primary button" slot="right" @click="gotoRegistration">
                    <span>Naar inschrijvingspagina</span>
                </button>
            </STToolbar>
            
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Mixins } from "vue-property-decorator";
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationBar, STToolbar, STList, STListItem, Checkbox, ErrorBox } from "@stamhoofd/components"
import MemberGeneralView from '../registration/MemberGeneralView.vue';
import { MemberManager } from '../../classes/MemberManager';
import { MemberWithRegistrations, Group, Payment, PaymentDetailed, RegistrationWithMember } from '@stamhoofd/structures';
import { OrganizationManager } from '../../classes/OrganizationManager';
import MemberGroupView from '../registration/MemberGroupView.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import FinancialProblemsView from './FinancialProblemsView.vue';
import { Formatter } from '@stamhoofd/utility';
import TransferPaymentView from './TransferPaymentView.vue';
import RegistrationOverviewView from './RegistrationOverviewView.vue';

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
            window.location.href = "https://"+this.organization.uri+".stamhoofd.be"
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>