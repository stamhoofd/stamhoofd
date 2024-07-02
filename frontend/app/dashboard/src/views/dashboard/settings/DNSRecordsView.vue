<template>
    <div id="dns-records-view" class="st-view">
        <STNavigationBar title="Instellingen" />

        <main>
            <h1>
                Pas de volgende instellingen aan
            </h1>
        
            <p class="st-list-description">
                Stel de volgende DNS-instellingen in voor jouw domeinnaam. Dit kan je meestal doen in het klantenpaneel van jouw registrar (bv. Combell, Versio, Transip, One.com, GoDaddy...) waar je je domeinnaam hebt gekocht.
            </p>

            <STErrorsDefault :error-box="errorBox" />
            
            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p class="warning-box">
                Kijk alles goed na voor je aanpassingen maakt, verwijder zeker geen bestaande DNS-records. Als je DNS-records verwijdert, kan jouw huidige website onbereikbaar worden.
            </p>
            <p class="warning-box">
                Het kan tot 24 uur duren tot de aanpassingen zijn doorgevoerd, in de meeste gevallen zou het binnen 1 uur al in orde moeten zijn. Je mag dit scherm sluiten als je de aanpassingen hebt gemaakt, we blijven op de achtergrond proberen en sturen jou een mailtje als alles in orde is.
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        Verifieer
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationDomains } from "@stamhoofd/structures"
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import DNSRecordBox from '../../../components/DNSRecordBox.vue';
import DNSRecordsDoneView from './DNSRecordsDoneView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        DNSRecordBox
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DNSRecordsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    saving = false

    session = this.$context

    get records() {
        return this.$organization.privateMeta?.dnsRecords ?? []
    }

    get mailDomain() {
        return this.$organization.privateMeta?.pendingMailDomain ?? this.$organization.privateMeta?.mailDomain  ?? "?"
    }
   
    async validate() {
        if (this.saving) {
            return;
        }
    
        this.saving = true

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "POST",
                path: "/organization/domain",
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: this.$organization.privateMeta?.pendingRegisterDomain ?? this.$organization.registerDomain
                }),
                decoder: Organization as Decoder<Organization>
            })

            this.$organization.deepSet(response.data)
            this.saving = false

            if (response.data.privateMeta && response.data.privateMeta.mailDomain && response.data.privateMeta.pendingMailDomain === null && response.data.privateMeta.pendingRegisterDomain === null) {
                this.show(new ComponentWithProperties(DNSRecordsDoneView, {}))
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }

        //this.pop({ force: true })
    }



}
</script>
