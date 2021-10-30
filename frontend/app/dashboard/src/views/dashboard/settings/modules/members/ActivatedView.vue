<template>
    <div id="members-activated-view" class="st-view background">
        <STNavigationBar title="Ledenadministratie is actief">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>Yay! 🥳 De ledenadministratie is actief</h1>

            <p>Tijd om alles correct in te stellen. Daarna kan je leden vragen om in te schrijven via jullie inschrijvingspagina (zie hieronder) of je kan ze importeren via Excel. Je kan ook gewoon zelf eerst even proberen in te schrijven. Je kan testleden daarna terug verwijderen (gebruik wel een geldig e-mailadres).</p>

            <hr>
            <h2>Inschrijvingsgroepen</h2>

            <p v-if="isYouth">
                Alle activiteiten, leeftijdsgroepen, kampen of andere groepen waarvoor leden kunnen inschrijven worden 'inschrijvingsgroepen' genoemd. Zo kunnen leden inschrijven voor activiteiten van jouw vereniging, maar ook bijvoorbeeld voor een volledig jaar, semester... Dat bepaal je zelf. Op het einde van een inschrijvingsperiode kan je per groep individueel een nieuwe inschrijvingsperiode starten waarna leden opnieuw moeten inschrijven. Je kan hen daarvoor uitnodigen via e-mail.
            </p>
            <p v-else>
                Leden worden opgedeeld in 'inschrijvingsgroepen'. Leden kunnen inschrijven voor één of meer van die groepen, of je schrijft ze er zelf in (importeren vanaf Excel of manueel). Zo kunnen leden inschrijven voor activiteiten van jouw vereniging, maar ook bijvoorbeeld voor een volledig jaar, semester... Dat bepaal je zelf. Op het einde van een inschrijvingsperiode kan je per groep individueel een nieuwe inschrijvingsperiode starten waarna leden opnieuw moeten inschrijven. Je kan hen daarvoor uitnodigen via e-mail.
            </p>

            <button class="button secundary" @click="manageGroups">
                <span class="icon settings" />
                <span>Instellen</span>
            </button>

            <hr>
            <h2>Welke gegevens wil je verzamelen?</h2>
            
            <p class="style-description-block">
                Je kan zelf kiezen welke informatie je wilt verzamelen van jouw leden (bv. geboortedatum, emailadres, telefoonnummer, eigen vragen...). Wijzig dit via de knop hieronder, of later via de instellingen.
            </p>

            <button class="button secundary" @click="manageRecords(true)">
                <span class="icon settings" />
                <span>Instellen</span>
            </button>

            <hr>
            <h2 class="style-with-button">
                <div>Jouw inschrijvingspagina</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">Openen</span>
                    </a>
                </div>
            </h2>

            <p>
                Leden kunnen inschrijven voor inschrijvingsgroepen via je eigen inschrijvingspagina of via een uitnodiging in een e-mail die je via Stamhoofd verstuurd.
            </p>


            <input v-tooltip="'Klik om te kopiëren'" class="input" :value="organization.registerUrl" readonly @click="copyElement">

            <p class="info-box">
                Je kan deze link later terugvinden bij Instellingen > Personaliseren. Daar kan je ook je eigen domeinnaam instellen als je die hebt, bv. inschrijven.mijnvereniging.be.
            </p>

            <hr>
            <h2>Handige links</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs'" target="_blank">
                    <span slot="left" class="icon link" />
                    Documentatie
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/domeinnaam-koppelen'" target="_blank">
                    <span slot="left" class="icon link" />
                    Domeinnaam koppelen
                </STListItem>


                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/emails-versturen'" target="_blank">
                    <span slot="left" class="icon link" />
                    E-mails versturen en e-mailadressen instellen
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/overschakelen-midden-werkjaar'" target="_blank">
                    <span slot="left" class="icon link" />
                    Overschakelen midden in een werkjaar
                </STListItem>

                <STListItem v-if="isYouth" :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/online-inschrijvingen-kampen-weekends'" target="_blank">
                    <span slot="left" class="icon link" />
                    Online inschrijvingen voor kampen en weekends
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <button slot="right" class="button primary" @click="dismiss">
                <span>Doorgaan</span>
                <span class="icon arrow-right" />
            </button>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STInputBox, STList, STListItem,STNavigationBar, STToolbar, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { OrganizationType } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import { buildManageGroupsComponent } from "../../buildManageGroupsComponent";
import RecordsSettingsView from "./RecordsSettingsView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        BackButton,
        LoadingButton,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class ActivatedView extends Mixins(NavigationMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get isYouth() {
        return this.organization.meta.type === OrganizationType.Youth
    }

    manageRecords(animated = true) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(RecordsSettingsView, {})
        }).setDisplayStyle("popup").setAnimated(animated))
    }

    manageGroups() {
        const component = buildManageGroupsComponent(this.organization)
            
        this.present(new ComponentWithProperties(NavigationController, {
            root: component
        }).setDisplayStyle("popup"))
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

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
