<template>
    <div class="st-view background" id="whatsnew-view">
        <STNavigationBar title="Wat is er nieuw?">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>Wat is er nieuw?</h1>

            <hr>
            <h2>Bekijk en print samenvattingen af (24 september)</h2>
            <p>Vanaf nu kan je een samenvatting opvragen en afdrukken van de leden die je selecteert. Die kan je meenemen tijdens een activiteit, op weekend of kamp.</p>

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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, STListItem, STList, Spinner, TooltipDirective, Tooltip } from "@stamhoofd/components";
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