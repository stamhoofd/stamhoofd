<template>
    <div id="referral-view" class="st-view background">
        <STNavigationBar title="Verdien tegoed">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Geef 25 euro, krijg tot 100 euro per vereniging
            </h1>
            <p>Ongetwijfeld kennen jullie nog veel andere verenigingen (of zijn jullie er in actief). Als je andere verenigingen aanbrengt, en ze minimaal 15 euro besteden ontvang je zelf ook gratis tegoed. Per vereniging die je aanbrengt ontvang je ook telkens iets meer (zie onder). Doe je het dus zorgvuldig en doordacht, dan kan je echt een hoop tegoed verzamelen zonder al te veel moeite. <strong class="style-strong">Verenigingen die de link niet gebruiken tellen niet mee en je kan achteraf je tegoed daarvoor niet meer ontvangen</strong>.</p>


            <Spinner v-if="loading" />
            <template v-if="!loading && status">
                <hr>
                <h2>Jouw doorverwijzingslink</h2>

                <input v-tooltip="'Klik om te kopiëren'" class="input" :value="href" readonly @click="copyElement">

                <p class="info-box">
                    Om andere verenigingen te motiveren om jouw link te gebruiken, krijgen ze zelf ook 25 euro tegoed. 
                </p>

                <hr>
                <h2>Overzicht van te verdienen tegoed</h2>
                <p>Het bedrag dat je ontvangt stijgt per vereniging tot maximaal 100 euro per vereniging. Dus als je 6 verenigingen hebt aangebracht, verdien je in totaal € 210! Breng je er 10 aan, dan verdien je 550 euro. Er zijn 45.000+ verenigingen in Vlaanderen, the sky is the limit 💰🤑.</p>

                <STList>
                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        1e vereniging

                        <span slot="right" class="style-tag large">€ 10</span>
                    </STListItem>
                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        2e vereniging

                        <span slot="right" class="style-tag large">€ 20</span>
                    </STListItem>
                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        3e vereniging

                        <span slot="right" class="style-tag large">€ 30</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        4e vereniging

                        <span slot="right" class="style-tag large">€ 40</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        5e vereniging

                        <span slot="right" class="style-tag large">€ 50</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        6e vereniging

                        <span slot="right" class="style-tag large">€ 60</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        7e vereniging

                        <span slot="right" class="style-tag large">€ 70</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        8e vereniging

                        <span slot="right" class="style-tag large">€ 80</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        9e vereniging

                        <span slot="right" class="style-tag large">€ 90</span>
                    </STListItem>

                    <STListItem>
                        <Checkbox slot="left" :checked="false" />
                        10e, 11e, 12e... vereniging

                        <span slot="right" class="style-tag large">€ 100</span>
                    </STListItem>
                </STList>

                <hr>
                <h2>Delen</h2>

                <STList>
                    <STListItem :selectable="true" @click="openFacebookShare">
                        <h2 class="style-title-list">
                            Delen op Facebook
                        </h2>
                        <span slot="right" class="icon share" />
                    </STListItem>
                    <STListItem :selectable="true" @click="openFacebookShare">
                        <h2 class="style-title-list">
                            Verstuur de link via SMS, e-mail, WhatsApp...
                        </h2>
                        <p class="style-description-small">
                            Verstuur niet alleen de link, maar geef er ook wat uitleg bij. Een mooie e-mail of bericht werkt eigenlijk altijd het beste.
                        </p>
                        <span slot="right" class="icon share" />
                    </STListItem>
                </STList>

                <hr>
                <h2>Tips</h2>

                <STList>
                    <STListItem>
                        <h2 class="style-title-list">
                            Wees authentiek, voeg altijd wat meer uitleg toe
                        </h2>

                        <p class="style-description-small">
                            Deel niet gewoon de link. Vertel een verhaal, voeg een foto of video toe. Zo ga je veel meer bereiken.
                        </p>
                    </STListItem>
                    <STListItem>
                        <h2 class="style-title-list">
                            Vraag alle vrijwilligers om de link of Facebook post ook te delen
                        </h2>
                    </STListItem>
                    <STListItem>
                        <h2 class="style-title-list">
                            Plaats een bericht op jullie website
                        </h2>
                    </STListItem>
                    <STListItem>
                        <h2 class="style-title-list">
                            Herinner nog eens op het juiste moment
                        </h2>
                        <p class="style-description-small">
                            Het beste moment om een vereniging door te verwijzen is vaak één maand voor ze met een nieuw werkjaar beginnen. Zet dat in je agenda en stuur dan nog eens een herinnering of post het dan nog eens op je Facebook pagina.
                        </p>
                    </STListItem>
                    <STListItem>
                        <h2 class="style-title-list">
                            Promoot Stamhoofd op jouw jeugdraad
                        </h2>
                        <p class="style-description-small">
                            Toon de QR-code ter plaatse, of stuur gewoon een e-mail achteraf.
                        </p>
                    </STListItem>
                    <STListItem>
                        <h2 class="style-title-list">
                            Promoot Stamhoofd in een (lokale) Facebook groep
                        </h2>
                        <p class="style-description-small">
                            Volg wel altijd de regels van de Facebook groep en plaats geen spam.
                        </p>
                    </STListItem>
                </STList>

                <hr>
                <h2>Geschiedenis</h2>
                <p>Hieronder kan je zien welke verenigingen jouw link hebben gebruikt en of ze al 15 euro hebben besteed.</p>

                <STList v-if="status.usedCodes.length > 0">
                    <STListItem v-for="used in status.usedCodes" :key="used.id" class="right-description">
                        <span slot="left" class="icon clock gray" />
                        <h2 class="style-title-list">
                            {{ used.organizationName }}
                        </h2>
                        <p v-if="used.creditValue !== null" class="style-description">
                            Je hebt jouw tegoed ontvangen!
                        </p>
                        <p v-else class="style-description">
                            Je ontvangt jouw tegoed zodra deze vereniging 15 euro heeft besteed.
                        </p>
                        <span v-if="used.creditValue !== null" slot="right" class="style-tag large success">{{ used.creditValue | price }}</span>
                    </STListItem>
                </STList>

                <p v-else class="info-box">
                    Jouw link werd nog niet gebruikt
                </p>

                <hr>

                <p class="style-description-small">
                    We betalen het tegoed nooit uit. Je kan het enkel gebruiken om pakketten in Stamhoofd aan te kopen. Je kan je tegoed niet doorgeven aan een andere vereniging. Tegoed is één jaar geldig, maar die geldigheid wordt telkens met één jaar verlengd als je er een deel van gebruikt (bv. je hebt 500 euro tegoed en gebruikt maar 59 euro, dan vervalt je tegoed nooit zolang je er jaarlijks iets van opgebruikt).
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, Spinner,STErrorsDefault,STInputBox, STList,STListItem, STNavigationBar, STToolbar, Toast, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { RegisterCodeStatus } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        STList,
        STListItem,
        Spinner
    },
    directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price.bind(Formatter)
    }
})
export default class ReferralView extends Mixins(NavigationMixin) {
    loading = true;
    status: RegisterCodeStatus | null = null

    created() {
        this.loadCode().catch(console.error)
    }

    get href() {
        return "https://www.stamhoofd.be/?code="+encodeURIComponent(this.status?.code ?? "")+"&org="+encodeURIComponent(OrganizationManager.organization.name)
    }

    async loadCode() {
        this.loading = true;

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/register-code",
                decoder: RegisterCodeStatus as Decoder<RegisterCodeStatus>
            })
            this.status = response.data
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show()
        }

        this.loading = false
    }
    
    mounted() {
        HistoryManager.setUrl("/settings/referrals");
    }

    openFacebookShare() {
        window.open("https://www.facebook.com/sharer/sharer.php?u=https://www.stamhoofd.be&quote="+encodeURIComponent("Wij gebruiken het Stamhoofd platform om onze vereniging te beheren en zijn er enorm tevreden van. We mogen 25 euro tegoed uitdelen aan alle verenigingen die zich op Stamhoofd registreren via onze link. Probeer het dus misschien ook uit voor jouw vereniging (sportclub, jeugdbeweging, school...)"), "pop", "width=600, height=400, scrollbars=no");
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
