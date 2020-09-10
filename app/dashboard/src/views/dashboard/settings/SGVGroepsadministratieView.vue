<template>
    <div class="st-view background" id="sgv-groepsadministratie-view">
        <STNavigationBar title="Groepsadministratie synchroniseren">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>Groepsadministrie synchroniseren</h1>

            <p class="warning-box">We raden echt heel sterk aan om alle leden gewoon opnieuw te laten inschrijven de eerste keer dat je overschakelt op Stamhoofd. Op die manier hebben alle ouders een account en kunnen ze tijdens het jaar gegevens wijzigen. Bovendien moet je zelf dan niet meer opvolgen wie nu stopt en wie niet. Dit is ook handig als we later dit jaar de inschrijvingen voor weekends en kampen uitrollen in Stamhoofd.</p>

            <hr>
            <h2>Hoe werkt het?</h2>
            <p>Stamhoofd voegt alle leden toe in de groepsadministratie en maakt de nodige wijzigingen. Dat doen we op basis van de voor, achternaam en geboortedatum.</p>

            <ul>
                <li>Nieuwe leden in groepsadministratie zetten</li>
                <li>Bestaande leden wijzigen en in de juiste tak zetten</li>
                <li>Adressen en ouders correct instellen</li>
                <li>Gestopte leden uitschrijven (dat doe je best pas vanaf de week voor de deadline van 15 oktober)</li>
                <li>Lidnummers ophalen</li>
                <li>Functies van leden worden correct ingesteld voor de standaard leeftijdsgroepen, deze schrappen en starten we waar nodig. Heb je tussentakken, dan moet je per tussentak een groepseigen functie maken met een naam die overeenkomt met de naam die je in Stamhoofd gebruikt. Doe je dat niet, dan krijg je een waarschuwing. Woudlopers schrijven we wel automatisch in bij wouters als er geen groepseigen functie is.</li>
                <li>(binnenkort) Leden importeren. Deze functie is vooral bedoeld als je tijdens het jaar start met Stamhoofd en leden niet opnieuw wil laten inschrijven.</li>
            </ul>

            <hr>
            <h2>Wat moet je nog zelf doen?</h2>

            <ul>
                <li>De functies van leiding en vrijwilligers goed instellen in de groepsadministratie (deze informatie staat niet in Stamhoofd)</li>
                <li>Als leiding niet inschrijft via Stamhoofd: deze zelf toevoegen en wijzigen</li>
                <li>Gestopte leiding/vrijwilligers schrappen</li>
                <li>We kunnen het e-mailadres niet wijzigen van leden die een login hebben in de groepsadministratie</li>
            </ul>

        </main>

        <STToolbar>
            <template slot="right">
                <a href="https://groepsadmin.scoutsengidsenvlaanderen.be" target="_blank" class="button secundary">
                    Naar groepsadministratie
                </a>
                <LoadingButton :loading="loading" >
                    <button class="button primary" v-if="isLoggedIn" @click="sync">
                        Synchroniseren
                    </button>
                     <button class="button primary" v-else @click="login">
                        Inloggen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController, HistoryManager } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, STListItem, STList, Spinner, TooltipDirective, Tooltip, Radio, RadioGroup, Toast } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';
import { Formatter } from '@stamhoofd/utility';
import { WhatsNewCount } from "../../../classes/WhatsNewCount"
import { SGVGroepsadministratie } from "../../../classes/SGVGroepsadministratie"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STListItem,
        STList,
        Spinner,
        LoadingButton
    },
     directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class SGVGroepsadministratieView extends Mixins(NavigationMixin) {
    loading = false;
    SGVGroepsadministratie = SGVGroepsadministratie

    mounted() {
        SGVGroepsadministratie.checkUrl();
        HistoryManager.setUrl("/scouts-en-gidsen-vlaanderen")
    }

    get isLoggedIn() {
        return SGVGroepsadministratie.hasToken
    }

    async sync() {
        if (this.loading) {
            return;
        }
        this.loading = true
        const toast = new Toast("Synchroniseren voorbereiden...", "spinner").setWithOffset().setHide(null).show()

        try {
            await SGVGroepsadministratie.downloadAll()
            const { matchedMembers, newMembers } = await SGVGroepsadministratie.matchAndSync(this, () => {
                toast.hide()
            })
            toast.hide();

            const { oldMembers, action } = await SGVGroepsadministratie.prepareSync(this, matchedMembers, newMembers)
            const toast2 = new Toast("Synchroniseren...", "spinner").setProgress(0).setWithOffset().setHide(null).show()

            try {
                await SGVGroepsadministratie.sync(this, matchedMembers, newMembers, oldMembers, action, (status, progress) => {
                    toast2.message = status
                    toast2.setProgress(progress)
                })
            } finally {
                toast2.hide()
            }

            new Toast("Synchronisatie voltooid", "success green").setWithOffset().show()
        } catch (e) {
            toast.hide()
            console.error(e)
            new Toast(e.message, "error red").setWithOffset().show()
        }
        this.loading = false
    }

    login() {
        SGVGroepsadministratie.startOAuth()
    }
}
</script>

<style lang="scss">
    @use "@stamhoofd/scss/base/text-styles.scss" as *;
    @use "@stamhoofd/scss/base/variables.scss" as *;

    #sgv-groepsadministratie-view {

        ul {
            list-style: none; 
            @extend .style-normal;
            padding-left: 30px;

            li {
                padding: 8px 0;
            }

            li::before {
                content: ""; 
                background: $color-primary;
                display: inline-block; 
                vertical-align: middle;
                width: 5px;
                height: 5px;
                margin-right: 15px;
                border-radius: 2.5px;
                margin-left: -20px;
            }
        }
    }
</style>