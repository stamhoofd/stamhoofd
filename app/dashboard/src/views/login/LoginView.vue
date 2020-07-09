<template>
    <div class="auto st-view login-view">
        <STNavigationBar title="Inloggen">
            <button slot="right" class="button close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
            <p>Vraag je mede leiding om je toe te voegen als beheerder als je nog geen account hebt.</p>

            <STInputBox title="E-mailadres">
                <input class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </STInputBox>

            <STInputBox title="Wachtwoord">
                <button slot="right" class="button icon right gray help" @click="gotoPasswordForgot">
                    Vergeten
                </button>
                <input class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
            </STInputBox>
        </main>

        <STFloatingFooter>
            <button class="button primary full">
                <span class="lock" />
                Inloggen
            </button>
        </STFloatingFooter>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,NavigationMixin } from "@simonbackx/vue-app-navigation";
import STInputBox from "@stamhoofd/components/src/inputs/STInputBox.vue"
import STFloatingFooter from "@stamhoofd/components/src/navigation/STFloatingFooter.vue"
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import { Component, Mixins } from "vue-property-decorator";

import ForgotPasswordView from './ForgotPasswordView.vue';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox
    }
})
export default class LoginView extends Mixins(NavigationMixin){

    gotoPasswordForgot() {
        this.show(new ComponentWithProperties(ForgotPasswordView, {}))
    }
    
}
</script>

<style lang="scss">
    .login-view {
    }
</style>