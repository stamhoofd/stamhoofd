<template>
    <div class="st-view background" id="missing-key-view">
        <STNavigationBar title="Wachten op goedkeuring">
        </STNavigationBar>

        <main>
            <h1>
                Wachten op goedkeuring
            </h1>

            <p class="style-description">Doordat je een nieuw account hebt aangemaakt of doordat je jouw wachtwoord vergeten was, heb je tijdelijk geen toegang meer tot de encryptie-sleutel waarmee je jouw gegevens kan ontcijferen. Maar geen paniek, je kan nog gewoon inschrijven en eventueel zelf alle gegevens aanvullen. Als je even geduld hebt keuren we jouw account terug goed en krijg je terug toegang.</p>

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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STInputBox, STNavigationBar, STToolbar, LoadingButton } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
    },
})
export default class MissingKeyView extends Mixins(NavigationMixin) {

}
</script>