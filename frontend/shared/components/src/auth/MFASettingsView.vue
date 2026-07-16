<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="status" class="st-view mfa-settings-view" data-testid="mfa-settings-view">
            <STNavigationBar :title="$t('Tweestapsverificatie')" />

            <main class="center">
                <h1>{{ $t('Tweestapsverificatie (2FA)') }}</h1>
                <p>{{ $t('Beveilig je account met een tweede factor naast je wachtwoord.') }}</p>

                <STErrorsDefault :error-box="errors.errorBox" />

                <hr><h2>{{ $t('Authenticator-apps') }}</h2>

                <STList>
                    <STListItem v-for="totp of status.totp" :key="totp.id" data-testid="totp-item">
                        <template #left>
                            <IconContainer icon="smartphone" class="success" aside-icon="success" />
                        </template>
                        <h3 class="style-title-list">
                            {{ totp.name || $t('Authenticator-app') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Toegevoegd op {date}', { date: Formatter.dateTime(totp.createdAt) }) }}
                        </p>
                        <p v-if="totp.lastUsedAt" class="style-description-small">
                            {{ $t('Laatst gebruikt op {date}', { date: Formatter.dateTime(totp.lastUsedAt) }) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('Nog nooit gebruikt') }}
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
                            {{ $t('Authenticator-app toevoegen') }}
                        </h3>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('Passkeys en beveiligingssleutels') }}</h2>

                <STList>
                    <STListItem v-for="passkey of status.passkeys" :key="passkey.id" data-testid="passkey-item">
                        <template #left>
                            <IconContainer icon="key" class="success" aside-icon="success" />
                        </template>
                        <h3 class="style-title-list">
                            {{ passkey.derivedName }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Toegevoegd op {date}', { date: Formatter.dateTime(passkey.createdAt) }) }}
                        </p>
                        <p v-if="passkey.lastUsedAt" class="style-description-small">
                            {{ $t('Laatst gebruikt op {date}', { date: Formatter.dateTime(passkey.lastUsedAt) }) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ $t('Nog nooit gebruikt') }}
                        </p>
                        <template #right>
                            <LoadingButton>
                                <button class="button icon trash" type="button" :data-testid="'delete-passkey-' + passkey.id" @click.prevent="deletePasskey(passkey.id)" />
                            </LoadingButton>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" data-testid="add-passkey" @click.prevent="addPasskey">
                        <template #left>
                            <IconContainer icon="key" aside-icon="add" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('Passkey of beveiligingssleutel toevoegen') }}
                        </h3>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('Herstelcodes') }}</h2>
                <p class="style-description-small">
                    {{ hasRecoveryCodes ? $t('Je hebt nog {count} herstelcodes over.', { count: status.recoveryCodesRemaining }) : $t('Je hebt nog geen herstelcodes.') }}
                </p>

                <STList>
                    <STListItem :selectable="true" data-testid="regenerate-recovery-codes" @click.prevent="regenerateRecoveryCodes">
                        <template #left>
                            <IconContainer icon="recovery-keys" aside-icon="trash stroke" class="error" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('Nieuwe herstelcodes genereren') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Je oude herstelcodes worden hierbij ongeldig.') }}
                        </p>
                    </STListItem>
                </STList>
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
import Spinner from '#Spinner.vue';

import { useFreshAction } from './useFreshAction';
import IconContainer from '#icons/IconContainer.vue';
import LoadingView from '#containers/LoadingView.vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';

const $context = useContext();
const errors = useErrors();
const present = usePresent();
const runFresh = useFreshAction();

const status = ref<MFAStatus | null>(null);

const hasRecoveryCodes = computed(() => status.value?.hasRecoveryCodes ?? false);

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
                        onCompleted: reload,
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
            Toast.success($t('{passkey-name} toegevoegd', { 'passkey-name': added?.derivedName ?? $t('Passkey') })).show();
        }
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function deleteTotp(id: string) {
    if (!await CenteredMessage.confirm($t('Deze authenticator-app verwijderen?'), $t('Verwijderen'))) {
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
    if (!await CenteredMessage.confirm($t('Deze passkey verwijderen?'), $t('Verwijderen'))) {
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
    if (!await CenteredMessage.confirm($t('Nieuwe herstelcodes genereren?'), $t('Genereren'), $t('Je oude herstelcodes worden hierbij ongeldig.'))) {
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
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}
</script>
