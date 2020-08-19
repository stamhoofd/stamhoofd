<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar title="Wachtwoord vergeten">
            <button slot="right" class="button icon gray close" type="button" @click="pop"></button>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>
            <div class="warning-box">Als je jouw wachtwoord vergeten bent kan je niet meer aan de gegevens van de leden die je hebt ingeschreven als je een nieuw wachtwoord instelt. Dat is niet echt een probleem, aangezien je die opnieuw kan ingeven.</div>

            <STErrorsDefault :error-box="errorBox" />


            <EmailInput title="E-mailadres" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" v-model="email" :validator="validator"/>
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    Opnieuw instellen
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STFloatingFooter, LoadingButton, STNavigationBar, EmailInput, Validator, ErrorBox, Toast, STErrorsDefault } from "@stamhoofd/components"
import { Component, Mixins } from "vue-property-decorator";
import { SessionManager } from '@stamhoofd/networking';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault
    }
})
export default class ForgotPasswordView extends Mixins(NavigationMixin){
    loading = false
    email = ""
    validator = new Validator()
    errorBox: ErrorBox | null = null

    async submit() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        if (!(await this.validator.validate())) {
            this.loading = false;
            return;
        }

        try {
            const response = await SessionManager.currentSession!.server.request({
                method: "POST",
                path: "/forgot-password",
                body: ForgotPasswordRequest.create({ email: this.email }),
            })

            this.dismiss({ force: true })
            new Toast("Je hebt een e-mail ontvangen waarmee je een nieuw wachtwoord kan instellen", "success").show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.loading = false;
    }
}
</script>

<style lang="scss">
    .forgot-password-view {
    }
</style>