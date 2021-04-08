<template>
    <div id="keys-view" class="st-view background">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Verloren sleutels
            </h1>
            <p>End-to-end versleuteling ligt aan de basis van de beveiliging van Stamhoofd. Als een gebruiker zijn wachtwoord vergeet, of een nieuw account aanmaakt binnen hetzelfde gezin, dan heeft die gebruiker geen toegang meer tot de encryptiesleutels. De gebruiker krijgt dan een melding dat hun account nog moet worden goedgekeurd. Ze kunnen wel al inschrijven, maar ze kunnen gewoon de bestaande gegevens niet bekijken (behalve voornaam) tenzij ze alles opnieuw ingeven. Hier kan je nakijken voor wie dit het geval is en kan je nieuwe sleutels delen met deze gebruikers.</p>

            
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadingButton, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        BackButton,
        LoadingButton,
    }
})
export default class KeysView extends Mixins(NavigationMixin) {
    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>