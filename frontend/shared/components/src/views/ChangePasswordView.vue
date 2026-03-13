<template>
    <SaveView class="auto" data-submit-last-field save-icon="lock" :title="$t(`%uu`)" @save="submit">
        <h1 v-if="$context.user?.hasPassword">
            {{ $t('%uu') }}
        </h1>
        <h1 v-else>
            {{ $t('%jl') }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <input id="username" style="display: none;" type="text" name="username" autocomplete="username" :value="email"><STInputBox :title="$t(`%WV`)">
            <input id="new-password" v-model="password" class="input" enterkeyhint="next" autocomplete="new-password" type="password" :placeholder="$t(`%ZV`)">
        </STInputBox>

        <STInputBox :title="$t(`%WW`)">
            <input id="confirm-password" v-model="passwordRepeat" enterkeyhint="go" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WX`)">
        </STInputBox>

        <PasswordStrength v-model="password" />
    </SaveView>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import PasswordStrength from '#inputs/PasswordStrength.vue';
import SaveView from '#navigation/SaveView.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STFloatingFooter from '#navigation/STFloatingFooter.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { Validator } from '#errors/Validator.ts';
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
                message: $t(`%12T`),
            }));
            return;
        }

        if (this.password.length < 8) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: '',
                message: $t(`%v2`),
            }));
            return;
        }
        this.loading = true;

        try {
            await LoginHelper.changePassword(this.$context, this.password);
            this.dismiss({ force: true });
            new Toast($t(`%12U`), 'success').show();
        }
        catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e);
            return;
        }
    }
}
</script>
