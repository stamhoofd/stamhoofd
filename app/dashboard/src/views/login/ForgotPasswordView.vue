<template>
    <div class="auto st-view forgot-password-view">
        <STNavigationBar title="Wachtwoord vergeten">
            <button v-if="canPop" slot="left" class="button icon left gray arrow-left" @click="pop">
                Inloggen
            </button>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>

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