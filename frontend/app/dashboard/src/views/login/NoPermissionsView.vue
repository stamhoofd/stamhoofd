<template>
    <div class="st-view">
        <main class="center">
            <h1>Deze pagina is voor beheerders</h1>
            <p>Oeps, deze website is enkel voor beheerders van {{ organization.name }}. Ga naar het ledenportaal als je je wilt inschrijven als lid.</p> 
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { Logo, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";



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