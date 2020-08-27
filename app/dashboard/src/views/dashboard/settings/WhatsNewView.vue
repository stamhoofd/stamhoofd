<template>
    <div class="st-view background" id="credits-view">
        <STNavigationBar title="Gratis en open-source">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>Wat is er nieuw?</h1>

            <hr>
            <h2>Koppel zelf Bancontact (27 augustus)</h2>
            <p>Via een nieuwe knop in het instellingen menu kan je nu zelf Bancontact activeren. Nadat je op die knop hebt gedrukt moet je een account aanmaken bij Mollie (onze betaalpartner). Doe dat enkel via die knop, anders kan je geen gebruik maken van de voordeligere tarieven die we via Stamhoofd hebben verkregen. Je hebt een VZW nodig om betalingen via Bancontact te accepteren. </p>

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
    #credits-view {
        .input-info {
            margin-top: 8px;
        }
    }
</style>