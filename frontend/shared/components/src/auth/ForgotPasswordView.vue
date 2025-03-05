<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar :title="$t(`Wachtwoord vergeten`)"/>
        <main class="center small">
            <h1>{{ $t('c2f9f716-35f7-4f98-9795-92fbb6e7c1a5') }}</h1>
            <p>{{ $t('1438dcdc-6e69-4679-a095-7567854fb04e') }}</p>
            
            <STErrorsDefault :error-box="errorBox"/>
            <EmailInput v-model="email" autocomplete="username" :validator="validator" class="max" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)" :placeholder="$t(`0a65c7be-dcc1-4bf7-9c6e-560085de9052`)"/>
        
            <LoadingButton :loading="loading" class="block">
                <button class="button primary full" type="submit">
                    {{ $t('3222d108-93be-4f6c-b4ca-7a6f384aa15f') }}
                </button>
            </LoadingButton>
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, EmailInput, ErrorBox, LoadingButton, STErrorsDefault, STFloatingFooter, STNavigationBar, Toast, Validator } from "@stamhoofd/components";
import { ForgotPasswordRequest } from '@stamhoofd/structures';

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
            await this.$context.server.request({
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
