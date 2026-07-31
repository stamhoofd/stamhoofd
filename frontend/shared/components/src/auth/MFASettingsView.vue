<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="status" class="st-view mfa-settings-view" data-testid="mfa-settings-view">
            <STNavigationBar :title="$t('%ZiA')" />

            <main class="center">
                <h1>{{ $t('%Zgk') }}</h1>
                <p>{{ $t('%ZhW') }}</p>

                <STErrorsDefault :error-box="errors.errorBox" />

                <hr><h2>{{ $t('%Zhz') }}</h2>

                <STList>
                    <STListItem v-for="totp of status.totp" :key="totp.id" data-testid="totp-item">
                        <template #left>
                            <IconContainer icon="smartphone" class="success" aside-icon="success" />
                        </template>
                        <h3 class="style-title-list">
                            {{ totp.name || $t('%ZgY') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%g7', { date: Formatter.dateTime(totp.createdAt) }) }}
                        </p>
                        <p v-if="totp.lastUsedAt" class="style-description-small">
                            {{ $t('%Zgd', { date: Formatter.dateTime(totp.lastUsedAt) }) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('%ZhC') }}
                        </p>
                        <template #right>
                            <LoadingButton>
                                <button class="button icon trash" type="button" :data-testid="'delete-totp-' + totp.id" @click.prevent="deleteTotp(totp.id)" />
                            </LoadingButton>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" data-testid="add-totp" @click.prevent="addAuthenticator">
                        <template #left>
                            <IconContainer icon="smartphone" aside-icon="add" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%Zgv') }}
                        </h3>
                    </STListItem>
                </STList>

                <template v-if="showPasskeySection">
                    <hr><h2>{{ $t('%ZgI') }}</h2>

                    <p v-if="passkeyBlockedReason === 'domain'" class="info-box" data-testid="passkey-domain-warning">
                        {{ $t('%ZgL', { domain: passkeyDomain }) }}
                    </p>
                    <p v-else-if="passkeyBlockedReason === 'unsupported'" class="info-box">
                        {{ $t('%ZgO') }}
                    </p>

                    <STList>
                        <STListItem v-for="passkey of status.passkeys" :key="passkey.id" data-testid="passkey-item">
                            <template #left>
                                <IconContainer :icon="passkey.icon" class="success" aside-icon="success" />
                            </template>
                            <h3 class="style-title-list">
                                {{ passkey.derivedName }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%g7', { date: Formatter.dateTime(passkey.createdAt) }) }}
                            </p>
                            <p v-if="passkey.lastUsedAt" class="style-description-small">
                                {{ $t('%Zgd', { date: Formatter.dateTime(passkey.lastUsedAt) }) }}
                            </p>
                            <p v-else class="style-description-small">
                                {{ $t('%ZhC') }}
                            </p>
                            <template #right>
                                <LoadingButton>
                                    <button class="button icon trash" type="button" :data-testid="'delete-passkey-' + passkey.id" @click.prevent="deletePasskey(passkey.id)" />
                                </LoadingButton>
                            </template>
                        </STListItem>

                        <STListItem v-if="canAddPasskey" :selectable="true" data-testid="add-passkey" @click.prevent="addPasskey">
                            <template #left>
                                <IconContainer icon="key" aside-icon="add" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%ZgT') }}
                            </h3>
                        </STListItem>
                    </STList>
                </template>

                <template v-if="hasRecoveryCodes || status.totp.length || status.passkeys.length">
                    <hr>
                    <h2>{{ $t('%ZhY') }}</h2>

                    <p class="style-description-small">
                        {{ $t('%ZhB') }}
                    </p>

                    <p class="info-box small">
                        {{ hasRecoveryCodes ? $t('%ZiF', { count: status.recoveryCodesRemaining }) : $t('Je hebt nog geen herstelcodes.') }}
                    </p>

                    <STList>
                        <STListItem :selectable="true" data-testid="regenerate-recovery-codes" @click.prevent="regenerateRecoveryCodes">
                            <template #left>
                                <IconContainer icon="recovery-keys" aside-icon="trash stroke" class="error" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%Zi8') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%Zi1') }}
                            </p>
                        </STListItem>
                    </STList>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { MFAManager } from '@stamhoofd/networking/MFAManager';
import type { MFAStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';

import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import IconContainer from '#icons/IconContainer.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { getPasskeyDomain, getPasskeyUnavailableReason } from './passkeyAvailability.ts';
import { useFreshAction } from './useFreshAction';

const $context = useContext();
const errors = useErrors();
const present = usePresent();
const runFresh = useFreshAction();

const status = ref<MFAStatus | null>(null);

const hasRecoveryCodes = computed(() => status.value?.hasRecoveryCodes ?? false);

/**
 * Passkeys need an account that may use them (the server decides) and a page served from
 * the domain they live on.
 */
const passkeyBlockedReason = computed(() => status.value?.canUsePasskeys ? getPasskeyUnavailableReason() : null);
const canAddPasskey = computed(() => (status.value?.canUsePasskeys ?? false) && passkeyBlockedReason.value === null);
const passkeyDomain = getPasskeyDomain();

/**
 * Accounts that cannot use passkeys never see the section, unless they still have one from
 * before - they have to be able to remove those.
 */
const showPasskeySection = computed(() => (status.value?.canUsePasskeys ?? false) || (status.value?.passkeys.length ?? 0) > 0);

onMounted(async () => {
    await reload();
});

async function reload() {
    try {
        status.value = await MFAManager.getStatus($context.value);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function addAuthenticator() {
    errors.errorBox = null;
    try {
        const totpSetup = await runFresh(() => MFAManager.setupTotp($context.value));
        await present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('./SetupTOTPView.vue'), {
                        totpSetup,
                        setupToken: null,
                        // We opened this flow in a sheet, so we are the one that closes it
                        // again and shows the updated list behind it.
                        onCompleted: async (navigation: NavigationActions) => {
                            await navigation.dismiss({ force: true });
                            await reload();
                        },
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function addPasskey() {
    errors.errorBox = null;
    try {
        const result = await runFresh(() => MFAManager.registerPasskey($context.value));
        if (!result) {
            return;
        }
        const allAdded = result.status.passkeys.filter(p => !status.value?.passkeys.find(pp => pp.id === p.id));
        status.value = result.status;

        const added = allAdded.length === 1 ? allAdded[0] : null;

        if (result.recoveryCodes && result.recoveryCodes.codes.length > 0) {
            await showRecoveryCodes(result.recoveryCodes.codes);
        } else {
            Toast.success($t('%Zha', { 'passkey-name': added?.derivedName ?? $t('%Zhp') })).show();
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function deleteTotp(id: string) {
    if (!await CenteredMessage.confirm($t('%ZhF'), $t('%CJ'))) {
        return;
    }
    errors.errorBox = null;
    try {
        status.value = await runFresh(() => MFAManager.deleteTotp($context.value, id));
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function deletePasskey(id: string) {
    if (!await CenteredMessage.confirm($t('%Zh0'), $t('%CJ'))) {
        return;
    }
    errors.errorBox = null;
    try {
        status.value = await runFresh(() => MFAManager.deletePasskey($context.value, id));
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function regenerateRecoveryCodes() {
    if (!await CenteredMessage.confirm($t('%ZgQ'), $t('%ZhA'), $t('%Zi1'))) {
        return;
    }
    errors.errorBox = null;
    try {
        const codes = await runFresh(() => MFAManager.regenerateRecoveryCodes($context.value));
        await showRecoveryCodes(codes.codes);
        await reload();
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function showRecoveryCodes(codes: string[]) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./ShowRecoveryCodesView.vue'), {
                    codes,
                    onCompleted: async (navigation: NavigationActions) => {
                        await navigation.dismiss({ force: true });
                        await reload();
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}
</script>
