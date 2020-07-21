<template>
    <div class="st-view forgot-password-view">
        <STNavigationBar title="Wachtwoord vergeten">
            <button slot="right" class="button icon gray close" @click="pop"></button>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>

            <div class="warning-box">Als je jouw wachtwoord opnieuw instelt zal je tijdelijk geen toegang meer hebben tot jouw gegevens. Deze worden versleuteld opgeslagen, dus het computersysteem zelf kan je geen toegang geven. We kunnen jouw toegang manueel herstellen maar dat kan even duren.</div>

            <STInputBox title="E-mailadres">
                <input class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <button class="button primary full">
                Versturen
            </button>
        </STFloatingFooter>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import STInputBox from "@stamhoofd/components/src/inputs/STInputBox.vue"
import STFloatingFooter from "@stamhoofd/components/src/navigation/STFloatingFooter.vue"
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox
    }
})
export default class ForgotPasswordView extends Mixins(NavigationMixin){
    
}
</script>

<style lang="scss">
    .forgot-password-view {
    }
</style>