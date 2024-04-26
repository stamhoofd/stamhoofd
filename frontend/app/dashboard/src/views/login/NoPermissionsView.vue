<template>
    <div class="st-view box-shade">
        <STNavigationBar :large="true">
            <template slot="left">
                <a alt="Stamhoofd" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener">
                    <Logo class="responsive" />
                </a>
            </template>
        </STNavigationBar>

        <main>
            <div class="box">
                <main>
                    <h1>Deze pagina is voor beheerders</h1>
                    <p>Oeps, deze website is enkel voor beheerders van {{ organization.name }}. Ga naar het ledenportaal als je je wilt inschrijven als lid.</p> 
                </main>
                
                <STToolbar>
                    <button slot="right" type="button" class="primary button" @click="gotoRegistration">
                        <span>Naar ledenportaal</span>
                    </button>

                    <button slot="right" type="button" class="button secundary" @click="logout">
                        <span class="icon logout" /><span>Uitloggen</span>
                    </button>
                </STToolbar>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Logo,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking";
import { Component, Mixins } from "vue-property-decorator";



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
        return this.$organization
    }

    gotoRegistration() {
        window.location.href = this.organization.registerUrl
    }

    logout() {
        this.$context.logout()
    }
}
</script>