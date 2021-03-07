<template>
    <div class="st-view" id="dns-records-view">
        <STNavigationBar title="Instellingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="!canPop && canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                Pas de volgende instellingen aan
            </h1>
        
            <p class="st-list-description">Stel volgende de DNS-instellingen in voor jouw domeinnaam. Dit kan je meestal doen in het klantenpaneel van jouw registrar (bv. Combell, Versio, Transip, One.com, GoDaddy...) waar je je domeinnaam hebt gekocht.</p>
            
            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p class="warning-box">Kijk alles goed na voor je aanpassingen maakt, verwijder zeker geen bestaande DNS-records. Als je DNS-records verwijdert, kan jouw huidige website onbereikbaar worden.</p>
            <p class="warning-box">Het kan tot 24 uur duren tot de aanpassingen zijn doorgevoerd, in de meeste gevallen zou het binnen 1 uur al in orde moeten zijn. Je mag dit scherm sluiten als je de aanpassingen hebt gemaakt, we blijven op de achtergrond proberen en sturen jou een mailtje als alles in orde is.</p>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="validate">
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
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationDomains } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import DNSRecordsDoneView from './DNSRecordsDoneView.vue';
import DNSRecordBox from '../../../components/DNSRecordBox.vue';

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

    session = SessionManager.currentSession

    get records() {
        return OrganizationManager.organization.privateMeta?.dnsRecords ?? []
    }

    get mailDomain() {
        return OrganizationManager.organization.privateMeta?.pendingMailDomain ?? OrganizationManager.organization.privateMeta?.mailDomain  ?? "?"
    }
   
    async validate() {
        if (this.saving) {
            return;
        }

    
        this.saving = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/organization/domain",
                body: OrganizationDomains.create({
                    mailDomain: this.mailDomain,
                    registerDomain: "inschrijven."+this.mailDomain
                }),
                decoder: Organization as Decoder<Organization>
            })

            OrganizationManager.organization.set(response.data)
            this.saving = false

            if (response.data.privateMeta && response.data.privateMeta.mailDomain && response.data.privateMeta.pendingMailDomain === null) {
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
