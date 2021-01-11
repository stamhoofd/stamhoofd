<template>
    <div id="whatsnew-view" class="st-view background">
        <STNavigationBar title="Wat is er nieuw?">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>Wat is er nieuw?</h1>

            <p>Blijf op de hoogte van al onze wijzigingen en krijg als eerste toegang tot nieuwe functies door ons te volgen op <a class="inline-link" href="https://instagram.com/stamhoofd" target="_blank">Instagram</a> of <a class="inline-link" href="https://facebook.com/stamhoofd" target="_blank">Facebook</a>.</p>
            
            <hr>
            <h2>Importeer leden vanaf Excel</h2>
            <p>Vanaf nu kan je leden importeren in Stamhoofd via Instellingen &gt; Leden importeren.</p>
            <p><a class="inline-link" href="https://instagram.com/stamhoofd" target="_blank">Meer info</a></p>

            <hr>
            <h2>Bouw je eigen webshop: spaghetti-festijn, tickets, wafelverkoop, ...</h2>
            <p>Met deze nieuwe functie kan je nu een centje bijverdienen. We lanceren deze functie voorlopig volledig gratis!</p>
            <p><a class="inline-link" href="https://instagram.com/stamhoofd" target="_blank">Meer info</a></p>

            <hr>
            <h2>Meer velden in Excel export (27 oktober) 📋</h2>
            <p><a class="inline-link" href="https://instagram.com/stamhoofd" target="_blank">Wat is er gewijzigd?</a></p>

            <hr>
            <h2>Betere e-mail functies en verbeteringen (26 oktober) 💌</h2>
            <p><a class="inline-link" href="https://facebook.com/stamhoofd" target="_blank">Wat is er gewijzigd?</a></p>

            <hr>
            <h2>Eenvoudiger om encryptiesleutels te delen als iemand zijn wachtwoord is vergeten (26 oktober) 🔑</h2>
            <p><a class="inline-link" href="https://facebook.com/stamhoofd" target="_blank">Wat is er gewijzigd?</a></p>

            <template v-if="isSGV">
                <hr>
                <h2>Synchroniseer met de groepsadministratie van Scouts &amp; Gidsen Vlaanderen (25 september)</h2>
                <p>Plaats automatisch nieuwe leden in de groepsadministratie en pas bestaande leden aan. Daarnaast kan je gestopte leden eenvoudig schrappen.</p>
                <p><a class="inline-link" href="https://www.facebook.com/stamhoofd/photos/a.115819256519977/338800554221845/" target="_blank">Meer info</a></p>
            </template>

            <hr>
            <h2>Bekijk en print samenvattingen af (24 september)</h2>
            <p>Vanaf nu kan je een samenvatting opvragen en afdrukken van de leden die je selecteert. Die kan je meenemen tijdens een activiteit, op weekend of kamp.</p>
            <p><a class="inline-link" href="https://www.facebook.com/stamhoofd/photos/a.115819256519977/338135777621656/" target="_blank">Meer info</a></p>

            <hr>
            <h2>Start- en einduur voor inschrijvingen (15 september)</h2>
            <p>Laat jouw inschrijvingen starten en stoppen om een bepaald uur. Dat kan ook voor je voorinschrijvingen.</p>

            <hr>
            <h2>Bekijk de gekoppelde accounts van elk lid + stuur e-mails naar leden op de wachtlijst (13 september)</h2>
            <p>Je kan nu zien met welk e-mailadres een ouder of lid kan inloggen om de gegevens van dat lid te wijzigen of te bekijken. Daarnaast nemen we die e-mailadressen ook op als je een e-mail verstuurt naar dat lid. Op de wachtlijst kan je nu e-mails versturen, en we openen automatisch het e-mail scherm als je leden toelaat.</p>

            <hr>
            <h2>Koppel zelf Bancontact + snelkoppeling naar inschrijvingspagina (27 augustus)</h2>
            <p>Via een nieuwe knop in het instellingen menu kan je nu zelf Bancontact activeren. Nadat je op die knop hebt gedrukt moet je een account aanmaken bij Mollie (onze betaalpartner). Doe dat enkel via die knop, anders kan je geen gebruik maken van de voordeligere tarieven die we via Stamhoofd hebben verkregen. Je hebt een VZW nodig om betalingen via Bancontact te accepteren. </p>
            <p>We hebben ook een fout verholpen dat je geen domeinnaam kon koppelen als daar een liggend streepje in voorkwam.</p>
            <hr>
            <h2>
                Stamhoofd is nu volledig gratis en open-source (25 augustus)
            </h2>
            <p>Alles wat je kent blijft, maar je hoeft niets meer te betalen om het te gebruiken. Zin om mee te bouwen aan Stamhoofd? Open dan zeker een issue of pull request in onze Github repositories.</p>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, patchContainsChanges,PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, BackButton, ErrorBox, LoadingButton, Spinner, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Tooltip,TooltipDirective, Validator } from "@stamhoofd/components";
import { LoginHelper,SessionManager } from '@stamhoofd/networking';
import { Address, Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Image, Organization, OrganizationMetaData, OrganizationPatch, OrganizationType, ResolutionFit, ResolutionRequest, UmbrellaOrganization,User, Version } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import { WhatsNewCount } from "../../../classes/WhatsNewCount"
import ChangePasswordView from './ChangePasswordView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STListItem,
        STList,
        Spinner
    },
     directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class WhatsNewView extends Mixins(NavigationMixin) {
    mounted() {
        // Mark whatsnew count
        localStorage.setItem("what-is-new", WhatsNewCount.toString());
    }

    get organization() {
        return OrganizationManager.organization
    }

    get isSGV() {
        return this.organization.meta.type == OrganizationType.Youth && this.organization.meta.umbrellaOrganization == UmbrellaOrganization.ScoutsEnGidsenVlaanderen
    }
}
</script>

<style lang="scss">
    @use "@stamhoofd/scss/base/text-styles.scss" as *;

    #whatsnew-view {
        main > p {
            margin-bottom: 15px;
            @extend .style-description;
        }
    }
</style>