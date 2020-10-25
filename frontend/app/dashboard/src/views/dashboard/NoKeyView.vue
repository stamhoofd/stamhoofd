<template>
    <div class="st-view background" id="no-key-view">
        <STNavigationBar title="Sleutel kwijt">
        </STNavigationBar>

        <main>
            <h1>
                Oeps! Je mist de encryptie-sleutel!
            </h1>

            <p class="style-description">Doordat je je wachtwoord vergeten bent heb je geen toegang meer tot de sleutel waarmee je de gegevens van je leden kan ontcijferen. Er zijn enkele oplossingen:</p>

            <hr>
            <h2>Een andere beheerder met administrator rechten helpt je uit de nood</h2>
            <p class="style-description">Vraag het volgende aan je mede beheerder.</p>

            <ol>
                <li>Ga naar Stamhoofd, klik op "Beheerders" in het menu.</li>
                <li>Klik rechtsbovenaan op het plusje</li>
                <li>Vul een naam in. Het e-mailadres mag je leeg laten.</li>
                <li>Ga verder (aanvinken van toegangsrechten heeft geen impact)</li>
                <li>Stuur de link naar de beheerder die geen sleutel meer heeft</li>
            </ol>

            <p class="style-description">Jij opent die link en doet het volgende:</p>
            <ol>
                <li>Als je nog niet ingelogd bent, klik dan op "ik heb al een account" in het uitnodigingvenster</li>
                <li>Log in</li>
                <li>Accepteer de uitnodiging</li>
                <li>Je hebt nu terug toegang 🥳</li>
            </ol>

            <hr>
            <h2>Andere beheerders hebben geen administrator rechten</h2>
            <p class="style-description">Geef een bestaande beheerder administrator rechten en volg de stappen hierboven. Opgelet: Je kan geen nieuwe beheerders aanmaken als je de sleutel mist. Voor je verder gaat moet je zeker een nieuwe sleutel aanmaken anders heb je ook geen toegang tot nieuwe leden of aanpassingen.</p>

            <hr>
            <h2>Er zijn geen andere beheerders</h2>
            <p class="style-description">Slecht nieuws! Je bent de toegang tot de gegevens van je leden kwijt. Je kan wel nog de voornaam van de leden zien, ten minste één e-mailadres en de betalingen bekijken en zien in welke groepen de leden ingeschreven zijn. </p>
            
            <ol>
                <li>Maak een nieuwe sleutel aan via de knop onderaan</li>
                <li>Vraag aan alle leden om terug naar de inschrijvingspagina te gaan en hun gegevens na te kijken. Het is belangrijk dat ze elk lid 'bewerken' en opslaan (ookal passen ze niets aan). Alle leden kunnen gelukkig nog aan al hun gegevens en moeten niet meer alles nakijken (tenzij ze zelf hun wachtwoord vergeten zijn).</li>
                <li>Vul eventueel zelf gegevens aan van leden, maar let op: zodra jij de gegevens aanpast verliest ook het lid alle gegevens die hij eerder had ingegeven en worden deze overschreven door jouw wijzigingen (ookal heb je bepaalde velden leeg gelaten).</li>
            </ol>

        </main>

        <STToolbar>
            <template slot="right">
                <button class="button destructive" @click="openNewKey">
                    <span class="icon trash"/><span>Nieuwe sleutel maken</span>
                </button>
                <button class="button primary" @click="dismiss">
                    Doorgaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, EmailInput, Toast } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';
import CreateNewKeyView from './CreateNewKeyView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
    },
})
export default class NoKeyView extends Mixins(NavigationMixin) {
    openNewKey() {
        this.present(new ComponentWithProperties(CreateNewKeyView, {}).setDisplayStyle("popup"));
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    #no-key-view {
        ol {
            list-style: none; 
            counter-reset: li;
            @extend .style-normal;
            padding: 15px 0;

            padding-left: 25px;

            li {
                counter-increment: li;
                padding: 5px 0;
            }

            li::before {
                content: counter(li)"."; 
                @extend .style-title-small;
                color: $color-primary;
                display: inline-block; 
                width: 25px;
                margin-left: -25px;;
            }
        }
    }
    
</style>