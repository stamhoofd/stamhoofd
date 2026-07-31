<template>
    <div class="st-view setup-mfa-view" data-testid="setup-mfa-view">
        <STNavigationBar :title="$t('%Zgx')" />

        <main class="center">
            <h1>{{ $t('%Zgx') }}</h1>

            <p>
                <I18nComponent :t="$t('Je account vereist tweestapsverificatie, maar je hebt dit nog niet ingesteld. Stel een extra verificatiestap in om verder te gaan. <button>Meer info</button>')">
                    <template #button="{content}">
                        <a class="inline-link" :href="LocalizedDomains.getDocs('tweestapsverificatie')" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList>
                <STListItem v-if="showPasskeys" :selectable="true" data-testid="mfa-setup-passkey" @click.prevent="startPasskeySetup">
                    <template #left>
                        <IconContainer icon="key" aside-icon="add" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%ZgT') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%Zht') }}
                    </p>
                    <template #right>
                        <LoadingButton :loading="loading">
                            <span class="icon arrow-right-small" />
                        </LoadingButton>
                    </template>
                </STListItem>

                <STListItem :selectable="true" data-testid="mfa-setup-totp" @click.prevent="startTotpSetup">
                    <template #left>
                        <IconContainer icon="smartphone" aside-icon="add" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%ZhV') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%ZhO') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { MFAManager } from '@stamhoofd/networking/MFAManager';
import { computed, ref } from 'vue';

import { canUsePasskeysOnThisDomain } from './passkeyAvailability.ts';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import IconContainer from '#icons/IconContainer.vue';
import BoxedController from '#containers/BoxedController.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';

const props = withDefaults(defineProps<{
    setupToken: string;
    // Whether this account may enroll a passkey at all (see User.canUsePasskeys).
    canUsePasskeys?: boolean;
    // Called after the first factor is enrolled and the session holds a fresh token.
    onCompleted: (navigation: NavigationActions) => void | Promise<void>;
}>(), {
    canUsePasskeys: false,
});

/**
 * Passkeys need both an account that may use them and a page that can reach the domain
 * they live on. An authenticator app always works, so we simply leave the option out
 * instead of showing something that cannot be started.
 */
const showPasskeys = computed(() => props.canUsePasskeys && canUsePasskeysOnThisDomain());

const $context = useContext();
const errors = useErrors();
const navigationActions = useNavigationActions();
const show = useShow();

const loading = ref(false);

async function startTotpSetup() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        const totpSetup = await MFAManager.setupTotp($context.value, props.setupToken);
        await show({
            components: [
                new ComponentWithProperties(BoxedController, {
                    root: AsyncComponent(() => import('./SetupTOTPView.vue'), {
                        totpSetup,
                        setupToken: props.setupToken,
                        onCompleted: props.onCompleted,
                    }),
                }),
            ],
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}

async function startPasskeySetup() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    errors.errorBox = null;
    try {
        const result = await MFAManager.registerPasskey($context.value, props.setupToken);
        if (!result) {
            return;
        }

        // Show the recovery codes BEFORE applying the session token: applying it completes
        // the session, which swaps the root of the app and destroys this flow.
        if (result.recoveryCodes && result.recoveryCodes.codes.length > 0) {
            await show({
                components: [
                    AsyncComponent(() => import('./ShowRecoveryCodesView.vue'), {
                        codes: result.recoveryCodes.codes,
                        // Hand on the actions of the view that actually finishes the flow,
                        // so whoever started it dismisses the right thing.
                        onCompleted: async (navigation: NavigationActions) => {
                            await MFAManager.applyEnrollmentResult($context.value, result);
                            await props.onCompleted(navigation);
                        },
                    }),
                ],
            });
            return;
        }

        await MFAManager.applyEnrollmentResult($context.value, result);
        await props.onCompleted(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}
</script>
