<template>
    <LoadingViewTransition :error-box="errorBox">
        <form v-if="!loadingSession" key="form" class="forgot-password-reset-view st-view" @submit.prevent="submit">
            <STNavigationBar :title="title" />
            <main class="center small">
                <h1>{{ title }}</h1>

                <p>{{ description }}</p>

                <STErrorsDefault :error-box="errorBox" />

                <STInputBox v-if="allowNameChange" class="max" error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`%Uy`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                        </div>
                    </div>
                </STInputBox>
                <EmailInput v-model="email" class="max" :validator="validator" autocomplete="username" :title="$t(`%1FK`)" :placeholder="$t(`%WT`)" />
                <div class="split-inputs">
                    <div>
                        <STInputBox class="max" :title="$t(`%ZV`)">
                            <input v-model="password" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%ZV`)">
                        </STInputBox>

                        <STInputBox class="max" :title="$t(`%WW`)">
                            <input v-model="passwordRepeat" class="input" autocomplete="new-password" type="password" :placeholder="$t(`%WX`)">
                        </STInputBox>
                    </div>
                    <div>
                        <PasswordStrength v-model="password" class="max" />
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
import { ComponentWithProperties, NavigationController, useDismiss, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import EmailInput from '#inputs/EmailInput.vue';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import CustomHooksContainer from '#containers/CustomHooksContainer.vue';
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
import type { NavigationActions } from '#types/NavigationActions.ts';
import type { MFASetupResponse } from '@stamhoofd/structures';
import { AppRoute, NewUser } from '@stamhoofd/structures';
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { useContext } from '../hooks/useContext';
import { useOrganization } from '../hooks/useOrganization';
import { usePlatform } from '../hooks/usePlatform';
import SignupPoliciesBox from './components/SignupPoliciesBox.vue';

const props = defineProps<{
    token: string;
}>();

const context = useContext();
const organization = useOrganization();
const platform = usePlatform();
const dismiss = useDismiss();
const show = useShow();
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

/**
 * Only set when this user is required to have two-factor authentication but hasn't set it
 * up yet. The session we received is temporary: the enrollment happens right after the
 * user chose a password, which is also the moment they get a real session.
 */
const mfaSetup = ref<MFASetupResponse | null>(null);
const passwordChanged = ref(false);
const verificationToken = ref<string | null>(null);

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

    trade().catch(console.error);
});

async function trade() {
    try {
        // A temporary session: it is only promoted to the session of the app once the user
        // is completely done (password chosen + second factor enrolled if required).
        const loadedSession = new SessionContext(context.value.organization, platform.value);
        loadedSession.disableStorage();
        const result = await LoginHelper.loginWithPasswordToken(loadedSession, props.token);

        if (result.mfaChallenge) {
            // This user has two-factor authentication: a password token alone is not
            // enough to load the account, let alone change its password.
            const mfaChallenge = result.mfaChallenge;
            const verified = await presentMFAFlow(loadedSession, onCompleted =>
                AsyncComponent(() => import('./ChooseMFAMethodView.vue'), {
                    mfaChallenge,
                    onCompleted,
                }),
            );

            if (!verified) {
                errorBox.value = new ErrorBox(new SimpleError({
                    code: 'mfa_required',
                    message: $t('Je moet de tweestapsverificatie voltooien om verder te gaan. Herlaad deze pagina om het opnieuw te proberen.'),
                }));
                return;
            }
        }

        // The user still has to enroll a second factor, but only after choosing a password.
        mfaSetup.value = result.mfaSetup ?? null;

        session.value = loadedSession;

        email.value = loadedSession.user?.email ?? '';
        firstName.value = loadedSession.user?.firstName ?? '';
        lastName.value = loadedSession.user?.lastName ?? '';
        hasAccount.value = loadedSession.user?.hasAccount ?? false;
        loadingToken.value = false;
    } catch (e) {
        errorBox.value = new ErrorBox(e);
        new Toast($t(`%uv`), 'error red').show();
        dismiss({ force: true }).catch(console.error);
    }
}

/**
 * Present a two-factor flow on top of our temporary session (the user is not signed in
 * yet, so these views may not act on the session of the app). Resolves false when the flow
 * was closed before it was finished.
 */
function presentMFAFlow(temporarySession: SessionContext, buildRoot: (onCompleted: (navigation: NavigationActions) => Promise<void>) => ComponentWithProperties): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        show({
            components: [
                new ComponentWithProperties(CustomHooksContainer, {
                    root: new ComponentWithProperties(NavigationController, {
                        // We opened this in a sheet, so we are the one that closes it again.
                        // Resolve before dismissing: closing unmounts the container, which
                        // resolves false shortly after, and the first resolve wins.
                        root: buildRoot(async (navigation: NavigationActions) => {
                            resolve(true);
                            await navigation.dismiss({ force: true });
                        }),
                    }),
                    hooks: () => {
                        onUnmounted(() => {
                            // Closed without finishing.
                            setTimeout(() => resolve(false), 100);
                        });
                    },
                }, {
                    provide: {
                        $context: temporarySession,
                    },
                }),
            ],
        }).catch(reject);
    });
}

/**
 * Enroll the required second factor. Only after this the user gets a real session: the
 * enrollment returns a new token, which is applied by the flow itself.
 */
async function presentMFASetup(setup: MFASetupResponse) {
    await show({
        components: [
            AsyncComponent(() => import('./SetupMFAView.vue'), {
                setupToken: setup.setupToken,
                canUsePasskeys: setup.canUsePasskeys,
                // We opened this flow in a sheet, so we close it again before moving on.
                onCompleted: async (_: NavigationActions) => {
                    await finish();
                },
            }, {
                provide: {
                    $context: session.value,
                },
            }),
        ],
    });
}

async function submit() {
    if (loading.value || loadingToken.value || !session.value) {
        return;
    }

    if (passwordChanged.value) {
        // The password is already saved, but the enrollment of the second factor was
        // closed before it was finished: pick it up again.
        if (mfaSetup.value) {
            await presentMFASetup(mfaSetup.value);
        }
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

        const result = await LoginHelper.patchUser(session.value, patch);
        passwordChanged.value = true;
        verificationToken.value = result.verificationToken ?? null;

        if (mfaSetup.value) {
            // Two-factor authentication is required for this user: enroll a factor before
            // signing in. That enrollment is what turns our temporary session into a real
            // one, so we only finish afterwards.
            loading.value = false;
            await presentMFASetup(mfaSetup.value);
            return;
        }

        await finish();
        loading.value = false;
    } catch (e) {
        loading.value = false;
        errorBox.value = new ErrorBox(e);
    }
}

/**
 * Sign the user in with the session of this flow and leave the view.
 */
async function finish() {
    if (!session.value) {
        return;
    }
    await SessionManager.prepareSessionForUsage(session.value);

    if (hasAccount.value) {
        new Toast($t(`%12U`), 'success green').show();
    } else {
        new Toast($t(`%uy`), 'success green').show();
    }

    const org = session.value.organization;
    if (verificationToken.value) {
        await appNavigate(AppRoute.VerifyEmail, {
            properties: {
                token: verificationToken.value,
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
}
</script>
