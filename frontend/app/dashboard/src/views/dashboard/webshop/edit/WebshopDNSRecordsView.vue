<template>
    <div class="st-view">
        <STNavigationBar title="DNS-instellingen" />

        <main>
            <h1>
                Pas de volgende instellingen aan
            </h1>
        
            <p class="st-list-description">
                Stel de volgende DNS-instellingen in voor jouw domeinnaam. Dit kan je meestal doen in het klantenpaneel van jouw registrar (bv. Combell, Versio, Transip, One.com, GoDaddy...) waar je je domeinnaam hebt gekocht.
            </p>

            <STErrorsDefault :error-box="errorBox" />

            <p v-if="isComplete" class="success-box">
                Alles is correct ingesteld.
            </p>
            
            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p v-if="!isComplete" class="warning-box">
                Kijk alles goed na voor je aanpassingen maakt, verwijder zeker geen bestaande DNS-records. Als je DNS-records verwijdert, kan jouw huidige website onbereikbaar worden.
            </p>
            <p v-if="!isComplete" class="warning-box">
                Het kan tot 24 uur duren tot de aanpassingen zijn doorgevoerd, in de meeste gevallen zou het binnen 1 uur al in orde moeten zijn. Je mag dit scherm sluiten als je de aanpassingen hebt gemaakt, we blijven op de achtergrond proberen en sturen jou een mailtje als alles in orde is.
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="skip">
                    Overslaan
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        Ik heb het ingesteld
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { DNSRecordStatus, PrivateWebshop } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import DNSRecordBox from '../../../../components/DNSRecordBox.vue';
import { WebshopManager } from '../WebshopManager';

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
export default class WebshopDNSRecordsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        webshopManager: WebshopManager

    errorBox: ErrorBox | null = null
    saving = false

    session = this.$context

    get records() {
        return this.webshopManager.webshop?.privateMeta.dnsRecords ?? []
    }

    get isComplete() {
        return !this.records.find(r => r.status !== DNSRecordStatus.Valid)
    }

    skip() {
        if (!this.isComplete) {
            new Toast("Hou er rekening mee dat jouw webshop voorlopig nog niet bereikbaar is op de door jou gekozen link. We gebruiken intussen de standaard domeinnaam van Stamhoofd. Wijzig eventueel de link terug tot iemand dit in orde kan brengen.", "warning yellow").setHide(15*1000).show()
        }
        this.dismiss()
    }

    async validate() {
        if (this.saving) {
            return;
        }

        this.saving = true

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "POST",
                path: "/webshop/"+this.webshopManager.webshop!.id+"/verify-domain",
                decoder: PrivateWebshop as Decoder<PrivateWebshop>,
                shouldRetry: false
            })

            this.saving = false

            this.webshopManager.updateWebshop(response.data)

            if (response.data.meta.domainActive) {
                new Toast("Je domeinnaam is goed geconfigureerd, jouw webshop is nu bereikbaar op deze nieuwe link.", "success green").show()
                this.dismiss({ force: true })
            } else {
                new Toast("We konden jouw domeinnaam nog niet activeren (zie foutmeldingen bij de DNS-records). Soms kan het even duren voor de wijzigingen doorkomen, we sturen je een e-mail zodra we ze wel opmerken.", "error red").show()
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