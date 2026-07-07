<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%HD`)" @save="save">
        <h1>
            {{ $t('%HD') }}
        </h1>

        <p>{{ $t('%HE') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

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
    </SaveView>
</template>

<script lang="ts" setup>
import type { ConvertArrayToPatchableArray } from '@simonbackx/simple-encoding';
import { usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { LoginMethod, LoginMethodConfig, LoginProviderType, PlatformConfig } from '@stamhoofd/structures';
import { ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
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

        await platformManager.value.patch(patch.value);
        new Toast($t(`%HA`), 'success green').show();
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
