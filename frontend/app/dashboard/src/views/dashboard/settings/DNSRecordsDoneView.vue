<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar title="Gelukt!">
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Gelukt! Jouw domeinnaam wordt binnenkort actief
            </h1>
        
            <p v-if="enableMemberModule" class="st-list-description">
                Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails naar jouw leden automatisch vanaf @{{ mailDomain }} verstuurd. Jullie ledenportaal zal waarschijnlijk al iets sneller beschikbaar zijn op {{ registerDomain }}.
            </p>
            <p v-else class="st-list-description">
                Het kan nog even duren voor jouw aanpassingen zich verspreid hebben over het internet. Binnenkort worden e-mails automatisch vanaf @{{ mailDomain }} verstuurd.
            </p>
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
import { BackButton, Checkbox,LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TooltipDirective } from "@stamhoofd/components";
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