<template>
    <div class="st-view boxed">
        <STNavigationBar :large="true" :sticky="true">
            <template slot="left">
                <a alt="Stamhoofd" href="https://www.stamhoofd.be" rel="noopener">
                    <Logo class="responsive" />
                </a>
            </template>
        </STNavigationBar>

        <div class="box">
            <main>
                <h1>Deze pagina is voor beheerders</h1>
                <p>Oeps, deze website is enkel voor beheerders van {{ organization.name }}. Ga naar de inschrijvingspagina als je je wilt inschrijven als lid.</p> 
            </main>

            <STToolbar>
                <button slot="right" class="primary button" @click="gotoRegistration">
                    <span>Naar inschrijvingspagina</span>
                </button>

                <button slot="right" class="button secundary" @click="logout">
                    <span class="icon logout" /><span>Uitloggen</span>
                </button>
            </STToolbar>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Logo,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Logo
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

    logout() {
        SessionManager.logout()
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>