<template>
    <div id="sgv-groepsadministratie-view" class="st-view background">
        <STNavigationBar title="Groepsadministratie" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>Groepsadministratie synchroniseren</h1>

            <p v-if="isTemporaryDisabled" class="error-box">
                Door een aanpassing in de groepsadministratie (waarschijnlijk een klein foutje), is het tijdelijk niet mogelijk om te synchroniseren (lidfuncties zijn onzichtbaar waardoor je ook manueel geen lid meer kan inschrijven).
            </p>

            <p class="info-box">
                Gaat er iets mis of heb je problemen bij de synchronisatie? Laat ons dan zeker iets weten via {{ $t('shared.emails.general') }}
            </p>

            <hr>
            <h2>Hoe werkt het?</h2>
            <p>Stamhoofd voegt alle leden toe in de groepsadministratie en maakt de nodige wijzigingen. Dat doen we op basis van de voornaam, achternaam en geboortedatum. Leden die op elkaar lijken proberen we zoveel mogelijk te 'matchen' met elkaar.</p>

            <ul>
                <li>Nieuwe leden in groepsadministratie zetten</li>
                <li>Bestaande leden wijzigen en in de juiste tak zetten</li>
                <li>Adressen en ouders correct instellen</li>
                <li>Gestopte leden uitschrijven (dat doe je best pas vanaf de week voor de deadline van 15 oktober). Opgelet: we schrappen enkel de functies waarvoor Stamhoofd verantwoordelijk is (de leeftijdsgroepen die in Stamhoofd staan).</li>
                <li>Lidnummers ophalen</li>
                <li>Functies van leden worden correct ingesteld voor de standaard leeftijdsgroepen, deze schrappen en starten we waar nodig. Tussentakken worden ook automatisch ondersteund: omdat je in de groepsadministratie altijd een 'hoofdfunctie' moet kiezen om facturen en dergelijke te krijgen voor die leden, gaan we tussentakken ook op basis van de ingestelde leeftijd of naam in Stamhoofd matchen op een hoofdtak. Alle woudlopers, wolven, kawellen, pioniers... komen dus ook terecht bij de juiste officiële tak afhankelijk van hun leeftijd. Leden die niet in hun normale leeftijdsgroep zitten, bijvoorbeeld een ouder lid die in een jongere tak zit, schrijven we in in hun werkelijke tak in Stamhoofd, maar enkel als de naam van de groep in Stamhoofd exact overeenkomt met een taknaam uit S&amp;GV (een giver die bij de woudlopers zit zullen we dus niet ondersteunen en wordt als giver ingeschreven in de groepsadministratie).</li>
                <li>Leden importeren kan door je leden uit de groepsadministratie te exporteren naar Excel en deze vervolgens te importeren in Stamhoofd via Instellingen > Leden importeren (normaal nooit nodig om dit te doen).</li>
            </ul>

            <hr>
            <h2>Wat moet je nog zelf doen?</h2>

            <ul>
                <li>De functies van leiding en vrijwilligers goed instellen in de groepsadministratie (deze informatie staat niet in Stamhoofd)</li>
                <li>Als leiding niet inschrijft via Stamhoofd: deze zelf toevoegen en wijzigen</li>
                <li>Als leiding wel inschrijft via Stamhoofd: nieuwe leiding eerst zelf toevoegen in de groepsadmin met de juiste functies (naam en geboortedatum is voldoende), en functies van bestaande leiding controleren in de groepsadministratie</li>
                <li>Gestopte leiding/vrijwilligers schrappen</li>
                <li>We kunnen het e-mailadres niet wijzigen van leden die een login hebben in de groepsadministratie</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <a href="https://groepsadmin.scoutsengidsenvlaanderen.be" target="_blank" class="button secundary">
                    Naar groepsadministratie
                </a>
                <LoadingButton :loading="loading">
                    <button v-if="isLoggedIn" key="syncButton" class="button primary" type="button" :disabled="!isStamhoofd && isTemporaryDisabled" @click="sync">
                        Synchroniseren
                    </button>
                    <button v-else key="loginButton" class="button primary" type="button" :disabled="!isStamhoofd && isTemporaryDisabled" @click="login">
                        Inloggen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import { SGVGroepsadministratie } from "../../../classes/SGVGroepsadministratie";

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
    SGVGroepsadministratie = new SGVGroepsadministratie(this.$context, this.$memberManager)

    mounted() {
        this.SGVGroepsadministratie.checkUrl();

        UrlHelper.setUrl("/scouts-en-gidsen-vlaanderen")
    }

    get isTemporaryDisabled() {
        return false
    }

    get isLoggedIn() {
        return this.SGVGroepsadministratie.hasToken
    }

    get isStamhoofd() {
        return this.$organizationManager.user.email.endsWith("@stamhoofd.be") || this.$organizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    async sync() {
        if (this.loading) {
            return;
        }
        this.loading = true
        const toast = new Toast("Synchroniseren voorbereiden...", "spinner").setHide(null).show()

        try {
            this.setLeave()
            await this.SGVGroepsadministratie.downloadAll()
            const { matchedMembers, newMembers } = await this.SGVGroepsadministratie.matchAndSync(this, () => {
                toast.hide()
            })
            toast.hide();

            const { oldMembers, action } = await this.SGVGroepsadministratie.prepareSync(this, matchedMembers, newMembers)
            const toast2 = new Toast("Synchroniseren...", "spinner").setProgress(0).setHide(null).show()

            try {
                await this.SGVGroepsadministratie.sync(this, matchedMembers, newMembers, oldMembers, action, (status, progress) => {
                    toast2.message = status
                    toast2.setProgress(progress)
                })
                toast2.hide()
            } catch (e) {
                toast2.hide()
                throw e
            }

            new Toast("Synchronisatie voltooid", "success green").show()
        } catch (e) {
            toast.hide()
            console.error(e)

            Toast.fromError(e).setHide(null).show()
        }
        this.removeLeave()
        this.loading = false
    }

    login() {
        console.log("Login, start OAuth")
        this.SGVGroepsadministratie.startOAuth()
    }

    beforeUnmount() {
        console.log("destroy")
        this.removeLeave()
    }

    leaveSet = false

    removeLeave() {
        if (!this.leaveSet) {
            return
        }
        console.log("removeLeave")
        window.removeEventListener("beforeunload", this.preventLeave);
        this.leaveSet = false
    }

    setLeave() {
        if (this.leaveSet) {
            return
        }
        console.log("set leave")
        this.leaveSet = true
        window.addEventListener("beforeunload", this.preventLeave);
    }

    preventLeave(event) {
        // Cancel the event
        event.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        event.returnValue = 'De synchronisatie is nog bezig. Wacht tot de synchronisatie is voltooid voor je de pagina verlaat';

        // This message is not visible on most browsers
        return "De synchronisatie is nog bezig. Wacht tot de synchronisatie is voltooid voor je de pagina verlaat"
    }

    shouldNavigateAway() {
        if (this.leaveSet) {
            new CenteredMessage("De synchronisatie is nog bezig", "Wacht tot de synchronisatie is voltooid voor je de pagina verlaat").addCloseButton().show()
            return false;
        }
        return true;
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
