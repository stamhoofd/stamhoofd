<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar :title="$t(`Wachtwoord vergeten`)" />
        <main class="center small">
            <h1>{{ $t('Wachtwoord vergeten') }}</h1>
            <p>{{ $t('Vul jouw e-mailadres in, en we sturen jou een e-mail waarmee je een nieuw wachtwoord kan kiezen.') }}</p>

            <STErrorsDefault :error-box="errorBox" />
            <EmailInput v-model="email" autocomplete="username" :validator="validator" class="max" :title="$t(`E-mailadres`)" :placeholder="$t(`Vul jouw e-mailadres hier in`)" />

            <LoadingButton :loading="loading" class="block">
                <button class="button primary full" type="submit">
                    {{ $t('Opnieuw instellen') }}
                </button>
            </LoadingButton>
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, EmailInput, ErrorBox, LoadingButton, STErrorsDefault, STFloatingFooter, STNavigationBar, Toast, Validator } from '@stamhoofd/components';
import { ForgotPasswordRequest } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        EmailInput,
        LoadingButton,
        STErrorsDefault,
        BackButton,
    },
})
export default class ForgotPasswordView extends Mixins(NavigationMixin) {
    loading = false;

    @Prop({ default: '' })
    initialEmail!: string;

    email = this.initialEmail;
    validator = new Validator();
    errorBox: ErrorBox | null = null;

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
                method: 'POST',
                path: '/forgot-password',
                body: ForgotPasswordRequest.create({ email: this.email }),
                shouldRetry: false,
            });

            this.dismiss({ force: true });
            new Toast('Je hebt een e-mail ontvangen waarmee je een nieuw wachtwoord kan instellen', 'success').show();
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.loading = false;
    }
}
</script>
