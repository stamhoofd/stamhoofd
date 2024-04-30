<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar title="Wachtwoord vergeten">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template #right><button class="button icon gray close" type="button" @click="dismiss" /></template>
        </STNavigationBar>
        <main>
            <h1>Wachtwoord vergeten</h1>
            <p>Vul jouw e-mailadres in, en we sturen jou een e-mail waarmee je een nieuw wachtwoord kan kiezen.</p>
            
            <STErrorsDefault :error-box="errorBox" />
            <EmailInput v-model="email" title="E-mailadres" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :validator="validator" />
        
            <LoadingButton :loading="loading" class="block bottom">
                <button class="button primary full" type="submit">
                    Opnieuw instellen
                </button>
            </LoadingButton>
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,EmailInput, ErrorBox, LoadingButton, STErrorsDefault,STFloatingFooter, STNavigationBar, Toast, Validator } from "@stamhoofd/components"
import { Session,SessionManager } from '@stamhoofd/networking';
import { ForgotPasswordRequest } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

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

    @Prop({ default: false})
    isAdmin!: boolean

    email = this.initialEmail
    validator = new Validator()
    errorBox: ErrorBox | null = null

    @Prop({ default: 
        function ()  {
            return this!.$context
    } })
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
                shouldRetry: false
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