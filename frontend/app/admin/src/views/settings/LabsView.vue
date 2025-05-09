<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`e58db898-16ad-4bb4-840c-2315ca894ff6`)" @save="save">
        <h1>
            {{ $t('5a5c1ed2-516e-43a1-9e64-25a7f6190ed3') }}
        </h1>

        <p>{{ $t('cdd2999b-28bf-4b9b-ba31-371cd3021923') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p class="info-box">
            {{ $t('bf96ea88-45a7-48ff-8d90-278388585046') }}
        </p>

        <hr><h2>
            {{ $t('8f9e2384-e2d3-46b7-a83e-3baed2b40936') }}
        </h2>

        <p>{{ $t('5dca5d6a-3d9f-48ab-beab-809905b13dbc') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox :model-value="getFeatureFlag('documents')" @update:model-value="setFeatureFlag('documents', !!$event)">
            {{ $t('a01ee6b1-f27f-4ad2-a87c-28bce4dedfbd') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('audit-logs')" @update:model-value="setFeatureFlag('audit-logs', !!$event)">
            {{ $t('1b5413cd-5858-4a73-872b-5b6b26345039') }}
        </Checkbox>

        <Checkbox :model-value="!getFeatureFlag('disable-events')" @update:model-value="setFeatureFlag('disable-events', !$event)">
            {{ $t('d9b4472a-a395-4877-82fd-da6cb0140594') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('member-trials')" @update:model-value="setFeatureFlag('member-trials', !!$event)">
            {{ $t('8273e002-e243-4d43-9085-c0a1e7c2c301') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('balance-emails')" @update:model-value="setFeatureFlag('balance-emails', !!$event)">
            {{ $t('4539b2ba-71f8-4839-aee8-60da1189b520') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('event-notifications')" @update:model-value="setFeatureFlag('event-notifications', !!$event)">
            {{ $t('caf486c6-818a-4d2b-9fdb-728c6af71481') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('table-registrations')" @update:model-value="setFeatureFlag('table-registrations', !!$event)">
            {{ $t('Tabel inschrijvingen') }}
        </Checkbox>

        <Checkbox :model-value="!!STAMHOOFD.domains.webshop" :disabled="true">
            {{ $t('e85a86ee-7751-4791-984b-f67dc1106f6b') }}
        </Checkbox>

        <hr><h2>{{ $t('57dd24f3-ae95-42d7-aaab-48e43483c018') }}</h2>

        <STList>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Password)" :label="$t(`f3bcb2fd-6f56-436a-bf8d-8cde0d924d6a`)" @update:model-value="setLoginMethod(LoginMethod.Password, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Password)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Google)" :label="$t(`af5f50da-3290-44bd-a104-896231e6ea08`)" @update:model-value="setLoginMethod(LoginMethod.Google, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Google)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.SSO)" :label="$t(`662467b7-da51-4fe2-bff4-784c8f028e58`)" @update:model-value="setLoginMethod(LoginMethod.SSO, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.SSO)" />
                </template>
            </CheckboxListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ConvertArrayToPatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, CheckboxListItem, ErrorBox, LoginMethodConfigView, Toast, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { usePlatformManager } from '@stamhoofd/networking';
import { LoginMethod, LoginMethodConfig, PlatformConfig } from '@stamhoofd/structures';
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
        new Toast($t(`17017abf-c2e0-4479-86af-300ad37347aa`), 'success green').show();
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
