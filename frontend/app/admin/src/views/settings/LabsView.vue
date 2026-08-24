<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%HD`)" @save="save">
        <h1>
            {{ $t('%HD') }}
        </h1>

        <p>{{ $t('%HE') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>{{ $t('%Zhg') }}</h2>

        <p>{{ $t('%Zgl') }}</p>

        <STList>
            <STListItem :selectable="true" element-name="label" data-testid="mfa-enabled">
                <template #left>
                    <Checkbox :model-value="getFeatureFlag('mfa')" @update:model-value="setFeatureFlag('mfa', !!$event)" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%Zgo') }}
                </h3>
                <p v-if="!getFeatureFlag('mfa')" class="style-description-small">
                    {{ $t('%Zgq') }}
                </p>
            </STListItem>

            <STListItem v-if="!getFeatureFlag('mfa')" :selectable="true" element-name="label" data-testid="mfa-admins-enabled">
                <template #left>
                    <Checkbox :model-value="getFeatureFlag('mfa-admins')" @update:model-value="setFeatureFlag('mfa-admins', !!$event)" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%ZhD') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%ZgH') }}
                </p>
            </STListItem>

            <STListItem v-if="getFeatureFlag('mfa') || requireTwoFactor || getFeatureFlag('mfa-admins')" :selectable="true" element-name="label" data-testid="mfa-required">
                <template #left>
                    <Checkbox v-model="requireTwoFactor" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%Zgt') }}
                </h3>
                <p class="style-description-small">
                    <I18nComponent :t="$t('%ZiX')">
                        <template #button="{content}">
                            <a class="inline-link" :href="LocalizedDomains.getDocs('tweestapsverificatie')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>
            </STListItem>

            <STListItem :selectable="true" data-testid="mfa-sign-out-admins" @click.prevent="signOutAdmins">
                <template #left>
                    <IconContainer icon="logout" aside-icon="power" class="error" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%ZhR') }}
                </h3>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('%HJ') }}</h2>

        <STList>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Password)" :label="$t(`%HK`)" @update:model-value="setLoginMethod(LoginMethod.Password, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Password)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Google)" :label="$t(`%1p`)" @update:model-value="setLoginMethod(LoginMethod.Google, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Google)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.SSO)" :label="$t(`%2b`)" @update:model-value="setLoginMethod(LoginMethod.SSO, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.SSO)" />
                </template>
            </CheckboxListItem>
        </STList>

        <hr><h2>
            {{ $t('%HF') }}
        </h2>

        <p>{{ $t('%HG') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox :model-value="!getFeatureFlag('disable-events')" @update:model-value="setFeatureFlag('disable-events', !$event)">
            {{ $t('%uB') }}
        </Checkbox>

        <Checkbox v-if="$isPlatform" :model-value="getFeatureFlag('member-trials')" @update:model-value="setFeatureFlag('member-trials', !!$event)">
            {{ $t('%7r') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('event-notifications')" :disabled="STAMHOOFD.userMode !== 'platform'" @update:model-value="setFeatureFlag('event-notifications', !!$event)">
            {{ $t('%CV') }}
        </Checkbox>
        <Checkbox :model-value="!!STAMHOOFD.domains.webshop" :disabled="true">
            {{ $t('%1Pd') }}
        </Checkbox>

        <Checkbox v-if="!!STAMHOOFD.domains.webshop" :model-value="getFeatureFlag('webshop-advanced-settings')" @update:model-value="setFeatureFlag('webshop-advanced-settings', !!$event)">
            {{ $t('%15o') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('impersonation')" @update:model-value="setFeatureFlag('impersonation', !!$event)">
            {{ $t('%ZnQ') }}
        </Checkbox>
    </SaveView>
</template>

<script lang="ts" setup>
import type { ConvertArrayToPatchableArray } from '@simonbackx/simple-encoding';
import { usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePatchPlatform } from '@stamhoofd/components/hooks/usePatchPlatform.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { LoginMethod, LoginMethodConfig, LoginProviderType, PlatformConfig, PlatformPrivateConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const patchPlatform = usePatchPlatform();
const platform = usePlatform();
const context = useContext();
const requestOwner = useRequestOwner();
const errors = useErrors();
const pop = usePop();

const present = usePresent();

const { patched, patch, hasChanges, addPatch } = usePatch(platform);
const saving = ref(false);

function getFeatureFlag(flag: string) {
    return patched.value.config.featureFlags.includes(flag) ?? false;
}

function setFeatureFlag(flag: string, value: boolean) {
    const featureFlags = patched.value.config.featureFlags.filter(f => f !== flag) ?? [];
    if (value) {
        featureFlags.push(flag);
    }

    addPatch({
        config: PlatformConfig.patch({
            featureFlags: featureFlags as any,
        }),
    });
}

const requireTwoFactor = computed({
    get: () => patched.value.privateConfig?.requireTwoFactor ?? false,
    set: (requireTwoFactor: boolean) => {
        addPatch({
            privateConfig: PlatformPrivateConfig.patch({
                requireTwoFactor,
            }),
        });
    },
});

/**
 * Requiring two-factor authentication is only enforced when a session is created, so admins
 * that are already signed in keep their session and are never asked to enroll. Ending those
 * sessions forces them through the login flow, and with that through the enrollment.
 */
async function signOutAdmins() {
    if (!await CenteredMessage.confirm({
        title: $t('%ZhZ'),
        confirmText: $t('%ZgX'),
        description: hasChanges.value
            ? $t('%ZgK')
            : $t('%Zgi'),
    })) {
        return;
    }

    await doSignOutAdmins();
}

/**
 * Ask to sign out the other admins right after two-factor authentication became required:
 * without it the requirement only applies to admins that sign in again on their own.
 */
async function askToSignOutAdmins() {
    if (!await CenteredMessage.confirm({
        title: $t('%ZhZ'),
        confirmText: $t('%ZgX'),
        description: $t('%Zi2'),
        cancelText: $t('%Zge'),
        destructive: false,
    })) {
        return;
    }

    await doSignOutAdmins();
}

async function doSignOutAdmins() {
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/platform/admins/sign-out',
            owner: requestOwner,
        });
        new Toast($t('%Zi7'), 'success green').show();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

function getLoginMethod(method: LoginMethod) {
    return patched.value.config.loginMethods.has(method) ?? false;
}

function setLoginMethod(method: LoginMethod, value: boolean) {
    if (getLoginMethod(method) === value) {
        return;
    }

    const originalValue = platform.value.config.loginMethods.get(method);

    const p = PlatformConfig.patch({
    });

    if (value) {
        p.loginMethods.set(method, originalValue ?? LoginMethodConfig.create({}));
    } else {
        p.loginMethods.set(method, null);
    }

    addPatch({
        config: p,
    });
}

async function editLoginMethodConfig(loginMethod: LoginMethod) {
    await present({
        components: [
            AsyncComponent(() => import('@stamhoofd/components/auth/LoginMethodSettingsView.vue'), {
                loginMethod,
                title: getLoginMethodTitle(loginMethod),
                configs: patched.value.config.loginMethods,
                provider: getLoginMethodProvider(loginMethod),
                saveHandler: async (patchMap: ConvertArrayToPatchableArray<Map<LoginMethod, LoginMethodConfig>>) => {
                    addPatch({
                        config: PlatformConfig.patch({
                            loginMethods: patchMap,
                        }),
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function getLoginMethodProvider(loginMethod: LoginMethod) {
    if (loginMethod === LoginMethod.SSO) {
        return LoginProviderType.SSO;
    }

    if (loginMethod === LoginMethod.Google) {
        return LoginProviderType.Google;
    }

    return null;
}

function getLoginMethodTitle(loginMethod: LoginMethod) {
    if (loginMethod === LoginMethod.Password) {
        return $t(`%HK`);
    }

    if (loginMethod === LoginMethod.Google) {
        return $t(`%1p`);
    }

    return $t(`%2b`);
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        // Read before saving, because saving updates the platform we compare against
        const startedRequiringTwoFactor = !platform.value.privateConfig?.requireTwoFactor && requireTwoFactor.value;

        await patchPlatform(patch.value);
        new Toast($t(`%HA`), 'success green').show();

        if (startedRequiringTwoFactor) {
            // After the patch, so the admins that sign in again already meet the new requirement
            await askToSignOutAdmins();
        }

        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
