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
            <p class="style-description">Contacteer Stamhoofd via hallo@stamhoofd.be. We kunnen je toegang normaal gezien nog herstellen met de hulp van de andere beheerders.</p>

            <hr>
            <h2>Er zijn geen andere beheerders</h2>
            <p class="style-description">Slecht nieuws! Je bent de toegang tot de gegevens van je leden kwijt. Je kan wel nog de voornaam van de leden zien, de betalingen bekijken en zien in welke groepen de leden ingeschreven zijn. Je moet zelf de rest van de gegevens opnieuw aanvullen of je vraagt aan al je leden om in te loggen en de gegevens nog eens opnieuw op te slaan (neem eerst contact op met hallo@stamhoofd.be als je daaraan begint). Er is geen manier om de gegevens te herstellen zonder hulp van je leden zelf. Neem best contact op met Stamhoofd om je te helpen om de gegevens terug aan te vullen via je leden.</p>

        </main>

        <STToolbar>
            <template slot="right">
                <button class="button primary" @click="dismiss">
                    Doorgaan zonder sleutel
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

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
    },
})
export default class NoKeyView extends Mixins(NavigationMixin) {
    

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