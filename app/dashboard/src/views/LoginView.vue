<template>
    <div class="auto st-view login-view">
        <STNavigationBar title="Inloggen">
            <button slot="right" class="button close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Inloggen</h1>
            <p>Vraag je mede leiding om je toe te voegen als beheerder als je nog geen account hebt.</p>

            <InputBox title="E-mailadres">
                <input class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </InputBox>

            <InputBox title="Wachtwoord">
                <button slot="right" class="button icon right gray help" @click="gotoPasswordForgot">
                    Vergeten
                </button>
                <input class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
            </InputBox>
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
import InputBox from "@stamhoofd/components/src/inputs/InputBox.vue"
import STFloatingFooter from "@stamhoofd/components/src/navigation/STFloatingFooter.vue"
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import { Component, Mixins } from "vue-property-decorator";

import ForgotPasswordView from './ForgotPasswordView.vue';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        InputBox
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
        max-width: 500px;
    }
</style>