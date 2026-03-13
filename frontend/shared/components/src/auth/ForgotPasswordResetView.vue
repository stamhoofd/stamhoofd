<template>
    <LoadingViewTransition>
        <form v-if="!loadingSession" key="form" class="forgot-password-reset-view st-view" @submit.prevent="submit">
            <STNavigationBar :title="title" />
            <main class="center small">
                <h1>{{ title }}</h1>

                <p>{{ description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <STInputBox v-if="allowNameChange" error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`%Uy`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                        </div>
                    </div>
                </STInputBox>
                <EmailInput v-model="email" :validator="validator" autocomplete="username" :title="$t(`%WS`)" :placeholder="$t(`%WT`)" />
                <div class="split-inputs">
                    <div>
                        <STInputBox :title="$t(`%ZV`)">
                            <input v-model="password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%ZV`)">
                        </STInputBox>

                        <STInputBox :title="$t(`%WW`)">
                            <input v-model="passwordRepeat" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WX`)">
                        </STInputBox>
                    </div>
                    <div>
                        <PasswordStrength v-model="password" />
                    </div>
                </div>

                <SignupPoliciesBox :validator="validator">
                    <LoadingButton :loading="loading" class="block input-spacing">
                        <button id="submit" class="button primary" type="submit">
                            <span class="icon lock" />
                            <span>{{ buttonText }}</span>
                        </button>
                    </LoadingButton>
                </SignupPoliciesBox>
            </main>
        </form>
    </LoadingViewTransition>
</template>

<script lang="ts">
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin, PushOptions } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import Checkbox from '#inputs/Checkbox.vue';
import ConfirmEmailView from '#auth/ConfirmEmailView.vue';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import PasswordStrength from '#inputs/PasswordStrength.vue';
import { ReplaceRootEventBus } from '#overlays/ModalStackEventBus.ts';
import Spinner from '#Spinner.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STFloatingFooter from '#navigation/STFloatingFooter.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { Validator } from '#errors/Validator.ts';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { NewUser, Token } from '@stamhoofd/structures';
import SignupPoliciesBox from './components/SignupPoliciesBox.vue';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        Checkbox,
        Spinner,
        PasswordStrength,
        LoadingViewTransition,
        SignupPoliciesBox,
    },
})
export default class ForgotPasswordResetView extends Mixins(NavigationMixin) {
    loading = false;
    loadingToken = true;
    email = '';
    password = '';
    firstName = '';
    lastName = '';

    passwordRepeat = '';

    errorBox: ErrorBox | null = null;
    validator = new Validator();

    @Prop({ required: true })
    token!: string;

    session: SessionContext | null = null;

    acceptPrivacy = false;
    acceptTerms = false;
    acceptDataAgreement = false;
    hasAccount = false;

    get loadingSession() {
        return !this.session || !this.session.user || this.loadingToken;
    }

    get title() {
        return this.hasAccount ? $t(`%oM`) : $t(`%ur`);
    }

    get allowNameChange() {
        return !this.hasAccount || (this.session && this.session.user && this.session.user.permissions !== null);
    }

    get description() {
        if (this.$organization) {
            return this.hasAccount
                ? $t(`%1AZ`, { organizationName: this.$organization.name })
                : $t(`%1Aa`, { organizationName: this.$organization.name });
        }
        return this.hasAccount ? $t(`%us`) : $t(`%ut`);
    }

    get buttonText() {
        return this.hasAccount ? $t(`%uu`) : $t(`%ur`);
    }

    mounted() {
        this.loadingToken = true;

        if (this.token) {
            const token = this.token;

            this.loadingToken = true;

            this.$context.server.request({
                method: 'POST',
                path: '/oauth/token',
                body: {
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    grant_type: 'password_token',
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    token: token,
                },
                decoder: Token,
            }).then(async (response) => {
                // Create new session to prevent signing in
                this.session = new SessionContext(this.$context.organization);
                // We don't want to save this session or reuse it on the next loads (yet)
                this.session.disableStorage();
                await this.session.setToken(response.data);
                await this.session.updateData(false, false);
                return this.session;
            })
                .then((session) => {
                    this.email = session.user?.email ?? '';
                    this.firstName = session.user?.firstName ?? '';
                    this.lastName = session.user?.lastName ?? '';
                    this.hasAccount = session.user?.hasAccount ?? false;
                    this.loadingToken = false;
                }).catch((e) => {
                    new Toast($t(`%uv`), 'error red').show();
                    this.dismiss({ force: true });
                });
        }
        else {
            new Toast($t(`%EF`), 'error red').show();
            this.dismiss({ force: true });
        }
    }

    get hasPermissions() {
        return this.session && this.session.user && !!this.session.user.permissions;
    }

    async submit() {
        if (this.loading || this.loadingToken || !this.session) {
            return;
        }

        if (this.allowNameChange) {
            try {
                const errors = new SimpleErrors();
                if (this.firstName.length < 2) {
                    errors.addError(new SimpleError({
                        code: 'invalid_field',
                        message: $t(`%uw`),
                        field: 'firstName',
                    }));
                }
                if (this.lastName.length < 2) {
                    errors.addError(new SimpleError({
                        code: 'invalid_field',
                        message: $t(`%ux`),
                        field: 'lastName',
                    }));
                }
                errors.throwIfNotEmpty();
            }
            catch (e) {
                this.errorBox = new ErrorBox(e);
                return;
            }
        }

        const valid = await this.validator.validate();

        if (this.password !== this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: '',
                message: $t(`%12T`),
            }));
            return;
        }

        const minChars = 8;

        if (this.password.length < minChars) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: '',
                message: $t(`%14k`, { count: minChars }),
            }));
            return;
        }

        if (!valid) {
            this.errorBox = null;
            return;
        }

        this.loading = true;

        // Request the key constants
        try {
            const patch = !this.allowNameChange
                ? NewUser.patch({
                        id: this.session.user!.id,
                        password: this.password,
                        email: this.email,
                    })
                : NewUser.patch({
                        id: this.session.user!.id,
                        password: this.password,
                        email: this.email,
                        firstName: this.firstName,
                        lastName: this.lastName,
                    });

            // Also change the email if it has been changed
            const { verificationToken } = await LoginHelper.patchUser(this.session, patch);
            // await SessionManager.setCurrentSession(this.session)
            await SessionManager.prepareSessionForUsage(this.session);

            // todo: switch current $context to session

            // If email has been changed or needs verification
            let initialPresents: PushOptions[] = [];
            if (verificationToken) {
                // Present instead of show, because the confirm is only needed to change the email address
                initialPresents = [
                    {
                        components: [
                            new ComponentWithProperties(ConfirmEmailView, { token: verificationToken, email: this.email }),
                        ],
                        modalDisplayStyle: 'sheet',
                    },
                ];
            }

            if (this.hasAccount) {
                const toast = new Toast($t(`%12U`), 'success green');
                toast.show();
            }
            else {
                const toast = new Toast($t(`%uy`), 'success green');
                toast.show();
            }

            const dashboard = await import('@stamhoofd/dashboard');
            const root = await dashboard.getScopedAutoRoot(this.session, {
                initialPresents,
            });

            await ReplaceRootEventBus.sendEvent('replace', root);

            this.dismiss({ force: true });
            this.loading = false;
        }
        catch (e) {
            this.loading = false;
            this.errorBox = new ErrorBox(e);
            return;
        }
    }
}
</script>
