<template>
    <form class="st-view forgot-password-view" @submit.prevent="submit">
        <STNavigationBar :title="$t(`0eb7d18f-2fd7-4ac8-acb6-5e1c31482b3c`)" />
        <main class="center small">
            <h1>{{ $t('66176374-df16-49fb-a487-5269b97e7286') }}</h1>
            <p>{{ $t('25514619-8e51-492b-aaad-48083b028148') }}</p>

            <STErrorsDefault :error-box="errorBox" />
            <EmailInput v-model="email" autocomplete="username" :validator="validator" class="max" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`55d8cd6e-91d1-4cbe-b9b4-f367bbf37b62`)" />

            <LoadingButton :loading="loading" class="block">
                <button class="button primary full" type="submit">
                    {{ $t('03602f85-5e57-4365-b491-f6fdb66ce3bd') }}
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
            new Toast($t(`9135aae1-14b5-4a92-b379-5f53702adffc`), 'success').show();
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.loading = false;
    }
}
</script>
