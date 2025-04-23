<template>
    <SaveView class="auto" data-submit-last-field save-icon="lock" :title="$t(`b33f433c-0957-4411-a0d6-0f41cf5caa63`)" @save="submit">
        <h1 v-if="$context.user?.hasPassword">
            {{ $t('cc1728cb-e600-4888-ad64-6ee498da11e0') }}
        </h1>
        <h1 v-else>
            {{ $t('2dd603e2-2caf-4573-8d8b-6ce8ff1dfda6') }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email"><STInputBox :title="$t(`adf7def3-6328-4261-a390-6cd006737aaf`)">
            <input id="new-password" v-model="password" class="input" enterkeyhint="next" autocomplete="new-password" type="password" :placeholder="$t(`722ac9a8-7ccb-4e3b-aa51-77132c19b2bb`)">
        </STInputBox>

        <STInputBox :title="$t(`ed8aef93-717e-406c-a779-2465dcd07baa`)">
            <input id="confirm-password" v-model="passwordRepeat" enterkeyhint="go" class="input" autocomplete="new-password" type="password" :placeholder="$t(`79537e4c-5363-4f06-9d82-9b1b007add73`)">
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
