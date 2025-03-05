<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Experimenten`)">
        <h1>
            {{ $t('361fe588-e3b6-41d0-a0fa-b10382b21ae9') }}
        </h1>

        <p>{{ $t('d98017d4-cff4-4baf-a22b-8cf1bad1b56e') }}</p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <Checkbox :model-value="getFeatureFlag('documents')" @update:model-value="setFeatureFlag('documents', !!$event)">
            {{ $t('eeb261d4-2a8d-46f3-ae06-f294fa1721a6') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('audit-logs')" @update:model-value="setFeatureFlag('audit-logs', !!$event)">
            {{ $t('b6df110f-d39b-40e5-9b9e-26fb7826cc60') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('member-trials')" @update:model-value="setFeatureFlag('member-trials', !!$event)">
            {{ $t('392cbcf9-5971-4784-a21a-4bef696a9227') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('cached-outstanding-balances')" @update:model-value="setFeatureFlag('cached-outstanding-balances', !!$event)">
            {{ $t('adc95cc6-1847-4148-a5c6-0dcfb8b5f9d9') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('balance-emails')" @update:model-value="setFeatureFlag('balance-emails', !!$event)">
            {{ $t('2bb1f340-6641-4308-a033-3847e696f8b8') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('event-notifications')" @update:model-value="setFeatureFlag('event-notifications', !!$event)">
            {{ $t('f935377f-905c-498d-97e6-bb2bb9181f60') }}
        </Checkbox>

        <hr><h2>{{ $t('e737600a-4492-47aa-84e3-673e32b15ea1') }}</h2>

        <STList>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Password)" @update:model-value="setLoginMethod(LoginMethod.Password, !!$event)" :label="$t(`032759a7-e6d6-429e-b4f0-5b8c6b1ae6dd`)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Password)"/>
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Google)" @update:model-value="setLoginMethod(LoginMethod.Google, !!$event)" :label="$t(`ebd38d7b-3085-467a-bd23-756600d6fa85`)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Google)"/>
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.SSO)" @update:model-value="setLoginMethod(LoginMethod.SSO, !!$event)" :label="$t(`c390b050-b87f-4842-807a-c040dcfa5aaa`)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.SSO)"/>
                </template>
            </CheckboxListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ConvertArrayToPatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, CheckboxListItem, ErrorBox, LoginMethodConfigView, Toast, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { LoginMethod, LoginMethodConfig, PlatformConfig } from '@stamhoofd/structures';
import { ref } from 'vue';

const platformManager = usePlatformManager();
const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const $t = useTranslate();
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
    }
    else {
        p.loginMethods.set(method, null);
    }

    addPatch({
        config: p,
    });
}

async function editLoginMethodConfig(loginMethod: LoginMethod) {
    await present({
        components: [
            new ComponentWithProperties(LoginMethodConfigView, {
                loginMethod,
                configs: patched.value.config.loginMethods,
                saveHandler: (patchMap: ConvertArrayToPatchableArray<Map<LoginMethod, LoginMethodConfig>>) => {
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
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
