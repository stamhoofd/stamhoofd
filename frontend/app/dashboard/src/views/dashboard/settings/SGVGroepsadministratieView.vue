<template>
    <div class="st-view background" id="sgv-groepsadministratie-view">
        <STNavigationBar title="Groepsadministratie synchroniseren">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>Groepsadministratie synchroniseren</h1>

            <p class="info-box">Gaat er iets mis of heb je problemen bij de synchronisatie? Laat ons dan zeker iets weten via hallo@stamhoofd.be</p>

            <hr>
            <h2>Hoe werkt het?</h2>
            <p>Stamhoofd voegt alle leden toe in de groepsadministratie en maakt de nodige wijzigingen. Dat doen we op basis van de voor, achternaam en geboortedatum. Leden die op elkaar lijken proberen we zoveel mogelijk te 'matchen' met elkaar.</p>

            <ul>
                <li>Nieuwe leden in groepsadministratie zetten</li>
                <li>Bestaande leden wijzigen en in de juiste tak zetten</li>
                <li>Adressen en ouders correct instellen</li>
                <li>Gestopte leden uitschrijven (dat doe je best pas vanaf de week voor de deadline van 15 oktober). Opgelet: we schrappen enkel de functies waarvoor Stamhoofd verantwoordelijk is (de leeftijdsgroepen die in Stamhoofd staan).</li>
                <li>Lidnummers ophalen</li>
                <li>Functies van leden worden correct ingesteld voor de standaard leeftijdsgroepen, deze schrappen en starten we waar nodig. Heb je tussentakken, dan raden we je aan om per tussentak een groepseigen functie te maken met een naam die overeenkomt met de naam die je in Stamhoofd gebruikt. Omdat je in de groepsadministratie altijd een 'hoofdfunctie' moet kiezen om facturen en dergelijke te krijgen voor die leden, gaan we tussentakken ook op basis van de ingestelde leeftijd of naam in Stamhoofd matchen op een hoofdtak. Alle woutlopers, wolven, kawellen... komen dus ook terecht bij de wouters.</li>
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

        if (WhatsNewCount as any == 5) {
            localStorage.setItem("what-is-new", WhatsNewCount.toString());
        }
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