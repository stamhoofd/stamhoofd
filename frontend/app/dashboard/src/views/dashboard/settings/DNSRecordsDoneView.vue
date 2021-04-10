<template>
    <div class="st-view" id="dns-records-view">
        <STNavigationBar title="Gelukt!">
            <button slot="right" class="button icon close gray" v-if="canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Gelukt! Jouw domeinnaam wordt binnenkort actief
            </h1>
        
            <p class="st-list-description" v-if="enableMemberModule">Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails naar jouw leden automatisch vanaf @{{ mailDomain }} verstuurd. Jouw inschrijvingspagina zal waarschijnlijk al iets sneller beschikbaar zijn op {{ registerDomain }}.</p>
            <p class="st-list-description" v-else>Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails automatisch vanaf @{{ mailDomain }} verstuurd.</p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button primary" @click="dismiss">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, TooltipDirective } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DNSRecordsDoneView extends Mixins(NavigationMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get registerDomain() {
        return OrganizationManager.organization.registerDomain ?? "?"
    }
   
    get mailDomain() {
        return OrganizationManager.organization.privateMeta?.mailDomain ?? "?"
    }

}
</script>