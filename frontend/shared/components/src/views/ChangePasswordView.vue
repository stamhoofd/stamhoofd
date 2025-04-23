<template>
    <SaveView class="auto" data-submit-last-field save-icon="lock" :title="$t(`Wachtwoord wijzigen`)" @save="submit">
        <h1 v-if="$context.user?.hasPassword">
            {{ $t('Wachtwoord wijzigen') }}
        </h1>
        <h1 v-else>
            {{ $t('Wachtwoord instellen') }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email"><STInputBox :title="$t(`Kies een wachtwoord`)">
            <input id="new-password" v-model="password" class="input" enterkeyhint="next" autocomplete="new-password" type="password" :placeholder="$t(`Kies een nieuw wachtwoord`)">
        </STInputBox>

        <STInputBox :title="$t(`Herhaal wachtwoord`)">
            <input id="confirm-password" v-model="passwordRepeat" enterkeyhint="go" class="input" autocomplete="new-password" type="password" :placeholder="$t(`Herhaal nieuw wachtwoord`)">
        </STInputBox>

        <PasswordStrength v-model="password" />
    </SaveView>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { ErrorBox, LoadingButton, PasswordStrength, SaveView, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar, Toast, Validator } from '@stamhoofd/components';
import { LoginHelper } from '@stamhoofd/networking';

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        PasswordStrength,
        SaveView,
    },
})
export default class ChangePasswordView extends Mixins(NavigationMixin) {
    loading = false;

    password = '';
    passwordRepeat = '';

    errorBox: ErrorBox | null = null;
    validator = new Validator();

    get email() {
        return this.$context.user?.email ?? '';
    }

    async submit() {
        if (this.loading) {
            return;
        }

        // Request the key constants

        if (this.password !== this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: '',
                message: 'De ingevoerde wachtwoorden komen niet overeen',
            }));
            return;
        }

        if (this.password.length < 8) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: '',
                message: 'Jouw wachtwoord moet uit minstens 8 karakters bestaan.',
            }));
            return;
        }
        this.loading = true;

        try {
            await LoginHelper.changePassword(this.$context, this.password);
            this.dismiss({ force: true });
            new Toast('Jouw nieuwe wachtwoord is opgeslagen', 'success').show();
        }
        catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e);
            return;
        }
    }
}
</script>
