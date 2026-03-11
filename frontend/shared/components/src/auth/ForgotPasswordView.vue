<template>
    <form class="st-view forgot-password-view" novalidate @submit.prevent="submit">
        <STNavigationBar :title="$t(`%uz`)" />
        <main class="center small">
            <h1>{{ $t('%uz') }}</h1>
            <p>{{ $t('%ZW') }}</p>

            <STErrorsDefault :error-box="errorBox" />
            <EmailInput v-model="email" autocomplete="username" :validator="validator" class="max" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />

            <LoadingButton :loading="loading" class="block">
                <button class="button primary full" type="submit">
                    {{ $t('%ZX') }}
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
            new Toast($t(`%v0`), 'success').show();
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.loading = false;
    }
}
</script>
