<template>
    <div id="no-key-view" class="st-view background">
        <STNavigationBar title="Sleutel kwijt">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Hoe kan je terug aan de gegevens van leden?
            </h1>

            <p class="style-description">
                Doordat je je wachtwoord vergeten bent heb je geen toegang meer tot de laatste encryptie-sleutel waarmee je de gegevens van nieuwe leden kan ontcijferen. Er zijn enkele oplossingen:
            </p>

            <hr>
            <h2>Een hoofdbeheerder helpt je uit de nood</h2>
            <p class="style-description">
                Vraag het volgende aan een hoofdbeheerder.
            </p>

            <ol>
                <li>Ga naar Stamhoofd, klik op Instellingen > Beheerders in het menu.</li>
                <li>Klik op jouw naam</li>
                <li>Onderaan bij 'Encryptiesleutels' geef je toegang tot alle sleutels</li>
            </ol>

            <p class="style-description">
                Daarna ga je terug naar stamhoofd.app. Je krijgt normaal een melding dat je de een encryptiesleutel hebt gekregen. Je kan nu terug alle gegevens bekijken.
            </p>

            <hr>
            <h2>Andere beheerders zijn geen hoofdbeheerders</h2>
            <p class="style-description">
                Verander een bestaande beheerder in een hoofdbeheerder (instellingen > beheerders) en volg de stappen hierboven. Opgelet: Je kan geen nieuwe beheerders aanmaken als je de sleutel mist. Voor je verder gaat moet je zeker een nieuwe sleutel aanmaken anders heb je ook geen toegang tot nieuwe leden of aanpassingen.
            </p>

            <hr>
            <h2>Er zijn geen andere beheerders</h2>
            <p class="style-description">
                Slecht nieuws! Je bent de toegang tot de gegevens van je leden kwijt. De leden zelf kunnen wel nog aan al hun gegevens en hoeven niet alles opnieuw in te geven, via goede communicatie kan je dus relatief eenvoudig alle gegevens terug halen. Je kan ondertussen nog de voornaam van de leden zien, ten minste één e-mailadres en de betalingen bekijken en zien in welke groepen de leden ingeschreven zijn.
            </p>
            
            <ol>
                <li>Maak een nieuwe sleutel aan via de knop onderaan</li>
                <li>Vraag aan alle leden om terug naar de inschrijvingspagina te gaan en hun gegevens na te kijken. Het is belangrijk dat ze elk lid 'bewerken' en opslaan (ookal passen ze niets aan). Alle leden kunnen gelukkig nog aan al hun gegevens en moeten niet meer alles nakijken (tenzij ze zelf hun wachtwoord vergeten zijn).</li>
                <li>Vul eventueel zelf gegevens aan van leden, maar let op: zodra jij de gegevens aanpast verliest ook het lid alle gegevens die hij eerder had ingegeven en worden deze overschreven door jouw wijzigingen (ookal heb je bepaalde velden leeg gelaten).</li>
            </ol>

            <button class="button destructive" @click="openNewKey">
                <span class="icon trash" /><span>Alle toegang vernietigen en een nieuwe sleutel maken</span>
            </button>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button primary" @click="dismiss">
                    Doorgaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingButton,STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

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