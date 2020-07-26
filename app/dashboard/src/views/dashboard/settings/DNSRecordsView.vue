<template>
    <div class="st-view" id="dns-records-view">
        <STNavigationBar title="Instellingen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Pas de volgende instellingen aan
            </h1>
        
            <p class="st-list-description">Stel volgende de DNS-instellingen in voor jouw domeinnaam. Dit kan je meestal doen in het klantenpaneel van jouw registrar (bv. Combell, Versio, Transip, One.com, GoDaddy...) waar je je domeinnaam hebt gekocht.</p>
            
            <div v-for="record in records" :key="record.id">
                <dl class="details-grid dns-records">
                    <dt>Type</dt>
                    <dd>{{ record.type }}</dd>

                    <dt>Naam</dt>
                    <dd class="selectable" @click="copyElement" v-tooltip="'Klik om te kopiëren'">{{ record.name }}</dd>

                    <dt>Waarde</dt>
                    <dd class="selectable" @click="copyElement" v-tooltip="'Klik om te kopiëren'">{{ record.value }}</dd>

                    <dt>TTL</dt>
                    <dd class="selectable" @click="copyElement">3600</dd>
                </dl>
                <template v-if="record.errors">
                    <div v-for="error in record.errors.errors" :key="error.id" class="error-box">
                        {{ error.human || error.message }}
                    </div>
                </template>
            </div>

            <p class="warning-box">Kijk alles goed na voor je aanpassingen maakt, verwijder zeker geen bestaande DNS-records. Als je DNS-records verwijdert kan jouw huidige website onbereikbaar worden.</p>
            <p class="warning-box">Het kan tot 24 uur duren tot de aanpassingen zijn doorgevoerd, in de meeste gevallen zou het binnen 1 uur al in orde moeten zijn. Je mag dit scherm ondertussen sluiten, we blijven op de achtergrond proberen en sturen jou een mailtje als alles in orde is.</p>
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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, TooltipDirective, Tooltip } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, DNSRecord, OrganizationDomains } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsDoneView from './DNSRecordsDoneView.vue';

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

            OrganizationManager.organization = response.data
            this.saving = false

            if ( response.data.privateMeta && response.data.privateMeta.mailDomain && response.data.privateMeta.pendingMailDomain === null) {
                this.show(new ComponentWithProperties(DNSRecordsDoneView, {}))
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }

        //this.pop({ force: true })
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const el = event.target;
        const rect = event.target.getBoundingClientRect();

        // Present

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


#dns-records-view {
    .dns-records {
        padding: 20px 20px;
        margin: 15px 0;
        border-radius: $border-radius;
        background: $color-white-shade;

        display: grid;
        grid-template-columns: 20% 80%;
        gap: 8px 0;

        @media (max-width: 400px) {
            margin: 15px calc(-1 * var(--st-horizontal-padding, 40px));
            padding: 20px var(--st-horizontal-padding, 40px);
        }

        dt {
            @extend .style-definition-term;
        }

        dd {
            @extend .style-definition-description;
            font-family: monospace;
            word-wrap: break-word;
            outline: 0;

            &.selectable {
                cursor: pointer;
            }
        }
    }
}
</style>
