<template>
    <SaveView class="auto" data-submit-last-field save-icon="lock" @save="submit" :title="$t(`Wachtwoord wijzigen`)">
        <h1 v-if="$context.user?.hasPassword">
            {{ $t('55f44c6c-4d38-480a-805f-2378d2ca4319') }}
        </h1>
        <h1 v-else>
            {{ $t('f7b5c0dc-2c0e-4b7a-9422-af08f0b520dc') }}
        </h1>

        <STErrorsDefault :error-box="errorBox"/>

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email"><STInputBox :title="$t(`418c9ab2-77de-441b-b9ab-af7bd55558ef`)">
            <input id="new-password" v-model="password" class="input" enterkeyhint="next" autocomplete="new-password" type="password" :placeholder="$t(`c28da8f7-0e6c-4159-98d8-d87f5ae7c533`)"></STInputBox>

        <STInputBox :title="$t(`64bc8c3c-4feb-4fb4-b5bf-71726f2b6609`)">
            <input id="confirm-password" v-model="passwordRepeat" enterkeyhint="go" class="input" autocomplete="new-password" type="password" :placeholder="$t(`91317163-c535-47be-a080-0f2b4f055dcc`)"></STInputBox>

        <PasswordStrength v-model="password"/>
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
