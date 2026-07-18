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
                <EmailInput v-model="email" :validator="validator" autocomplete="username" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />
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

<script lang="ts" setup>
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import EmailInput from '#inputs/EmailInput.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useAppNavigate } from '#hooks/useAppNavigate.ts';
import LoadingButton from '#navigation/LoadingButton.vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import PasswordStrength from '#inputs/PasswordStrength.vue';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { Validator } from '#errors/Validator.ts';
import { LoginHelper } from '@stamhoofd/networking/LoginHelper';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
import { SessionManager } from '@stamhoofd/networking/SessionManager';
import { AppRoute, NewUser, Token } from '@stamhoofd/structures';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useContext } from '../hooks/useContext';
import { useOrganization } from '../hooks/useOrganization';
import SignupPoliciesBox from './components/SignupPoliciesBox.vue';

const props = defineProps<{
    token: string;
}>();

const context = useContext();
const organization = useOrganization();
const dismiss = useDismiss();
const appNavigate = useAppNavigate();
const loading = ref(false);
const loadingToken = ref(true);
const email = ref('');
const password = ref('');
const firstName = ref('');
const lastName = ref('');
const passwordRepeat = ref('');
const errorBox = ref<ErrorBox | null>(null);
const validator = new Validator();
const session = shallowRef<SessionContext | null>(null);
const hasAccount = ref(false);

const loadingSession = computed(() => !session.value?.user || loadingToken.value);
const title = computed(() => hasAccount.value ? $t(`%oM`) : $t(`%ur`));
const allowNameChange = computed(() => !hasAccount.value || session.value?.user?.permissions !== null);
const description = computed(() => {
    if (organization.value) {
        return hasAccount.value
            ? $t(`%1AZ`, { organizationName: organization.value.name })
            : $t(`%1Aa`, { organizationName: organization.value.name });
    }
    return hasAccount.value ? $t(`%us`) : $t(`%ut`);
});
const buttonText = computed(() => hasAccount.value ? $t(`%uu`) : $t(`%ur`));

onMounted(() => {
    if (!props.token) {
        new Toast($t(`%EF`), 'error red').show();
        dismiss({ force: true }).catch(console.error);
        return;
    }

    context.value.server.request({
        method: 'POST',
        path: '/oauth/token',
        body: {
            grant_type: 'password_token',
            token: props.token,
        },
        decoder: Token,
    }).then(async (response) => {
        const newSession = new SessionContext(context.value.organization);
        newSession.disableStorage();
        await newSession.setToken(response.data);
        await newSession.updateData(false, false);
        session.value = newSession;
        return newSession;
    }).then((loadedSession) => {
        email.value = loadedSession.user?.email ?? '';
        firstName.value = loadedSession.user?.firstName ?? '';
        lastName.value = loadedSession.user?.lastName ?? '';
        hasAccount.value = loadedSession.user?.hasAccount ?? false;
        loadingToken.value = false;
    }).catch(() => {
        new Toast($t(`%uv`), 'error red').show();
        dismiss({ force: true }).catch(console.error);
    });
});

async function submit() {
    if (loading.value || loadingToken.value || !session.value) {
        return;
    }

    if (allowNameChange.value) {
        try {
            const errors = new SimpleErrors();
            if (firstName.value.length < 2) {
                errors.addError(new SimpleError({ code: 'invalid_field', message: $t(`%uw`), field: 'firstName' }));
            }
            if (lastName.value.length < 2) {
                errors.addError(new SimpleError({ code: 'invalid_field', message: $t(`%ux`), field: 'lastName' }));
            }
            errors.throwIfNotEmpty();
        } catch (e) {
            errorBox.value = new ErrorBox(e);
            return;
        }
    }

    const valid = await validator.validate();
    if (password.value !== passwordRepeat.value) {
        errorBox.value = new ErrorBox(new SimpleError({ code: '', message: $t(`%12T`) }));
        return;
    }

    const minChars = 8;
    if (password.value.length < minChars) {
        errorBox.value = new ErrorBox(new SimpleError({ code: '', message: $t(`%14k`, { count: minChars }) }));
        return;
    }
    if (!valid) {
        errorBox.value = null;
        return;
    }

    loading.value = true;
    try {
        const patch = !allowNameChange.value
            ? NewUser.patch({
                    id: session.value.user!.id,
                    password: password.value,
                    email: email.value,
                })
            : NewUser.patch({
                    id: session.value.user!.id,
                    password: password.value,
                    email: email.value,
                    firstName: firstName.value,
                    lastName: lastName.value,
                });

        const { verificationToken } = await LoginHelper.patchUser(session.value, patch);
        await SessionManager.prepareSessionForUsage(session.value);

        if (hasAccount.value) {
            new Toast($t(`%12U`), 'success green').show();
        } else {
            new Toast($t(`%uy`), 'success green').show();
        }

        const org = session.value.organization;
        if (verificationToken) {
            await appNavigate(AppRoute.VerifyEmail, {
                properties: {
                    token: verificationToken,
                    email: email.value,
                    organization: org,
                },
                adjustHistory: false,
            });
        } else if (org) {
            await appNavigate(AppRoute.OrgScopedAuto, { properties: { organization: org }, adjustHistory: false });
        } else {
            await appNavigate(AppRoute.UnscopedAuto, { adjustHistory: false });
        }
        loading.value = false;
    } catch (e) {
        loading.value = false;
        errorBox.value = new ErrorBox(e);
    }
}
</script>
