<template>
    <div id="missing-key-view" class="st-view background">
        <STNavigationBar title="Wachten op goedkeuring" />

        <main>
            <h1>
                Wachten op goedkeuring
            </h1>

            <p class="style-description">
                Doordat je een nieuw account hebt aangemaakt of doordat je jouw wachtwoord vergeten was, heb je tijdelijk geen toegang meer tot de encryptie-sleutel waarmee je jouw gegevens kan ontcijferen. Maar geen paniek, je kan nog gewoon inschrijven en eventueel zelf alle gegevens aanvullen. Als je even geduld hebt, keuren we jouw account terug goed en krijg je terug toegang.
            </p>
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
import { LoadingButton,STInputBox, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { LoginHelper, SessionManager } from "@stamhoofd/networking";
import { User } from "@stamhoofd/structures";
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
    mounted() {
        if (!SessionManager.currentSession!.user!.requestKeys) {
            LoginHelper.patchUser(SessionManager.currentSession!, User.patch({
                id: SessionManager.currentSession!.user!.id,
                requestKeys: true
            })).catch(e => {
                console.error(e)
            })
        }
    }
}
</script>