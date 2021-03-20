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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

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