<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar title="Wachtwoord vergeten">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button slot="right" class="button icon gray close" type="button" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>
            <div class="warning-box">
                Als je jouw wachtwoord vergeten bent kan je tijdelijk niet meer aan de gegevens van de leden die je hebt ingeschreven als je een nieuw wachtwoord instelt tot we jou terug hebben goedgekeurd. Maar dat is niet echt een probleem, aangezien je ook alles opnieuw kan ingeven.
            </div>

            <STErrorsDefault :error-box="errorBox" />


            <EmailInput v-model="email" title="E-mailadres" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :validator="validator" />
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
import { BackButton,EmailInput, ErrorBox, LoadingButton, STErrorsDefault,STFloatingFooter, STNavigationBar, Toast, Validator } from "@stamhoofd/components"
import { Session,SessionManager } from '@stamhoofd/networking';
import { ForgotPasswordRequest } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault,
        BackButton
    }
})
export default class ForgotPasswordView extends Mixins(NavigationMixin){
    loading = false

    @Prop({ default: ""})
    initialEmail!: string

    email = this.initialEmail
    validator = new Validator()
    errorBox: ErrorBox | null = null

    @Prop({ default: () => SessionManager.currentSession })
    session!: Session

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
            const response = await this.session.server.request({
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