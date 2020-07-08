<template>
    <div class="auto st-view forgot-password-view">
        <STNavigationBar title="Wachtwoord vergeten">
            <button v-if="canPop" slot="left" class="button icon left arrow-left" @click="pop">
                Terug
            </button>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>

            <InputBox title="E-mailadres">
                <input class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email">
            </InputBox>
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
import InputBox from "@stamhoofd/components/src/inputs/InputBox.vue"
import STFloatingFooter from "@stamhoofd/components/src/navigation/STFloatingFooter.vue"
import STNavigationBar from "@stamhoofd/components/src/navigation/STNavigationBar.vue"
import { Component, Mixins } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        InputBox
    }
})
export default class ForgotPasswordView extends Mixins(NavigationMixin){
    
}
</script>

<style lang="scss">
    .forgot-password-view {
        max-width: 500px;
    }
</style>