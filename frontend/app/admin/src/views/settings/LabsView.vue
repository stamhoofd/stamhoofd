<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`Experimenten`)" @save="save">
        <h1>
            {{ $t('Experimenten') }}
        </h1>

        <p>{{ $t('Hier kan je functies aanzetten die we nog aan het uittesten zijn, of functies die enkel voor geavanceerdere gebruikers nodig zijn.') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p class="info-box">
            {{ $t('Geen experimentele functies op dit moment.') }}
        </p>

        <hr><h2>
            {{ $t('Functionaliteiten') }}
        </h2>

        <p>{{ $t('Hier kan je bepaalde functies in- of uitschakelen.') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox :model-value="getFeatureFlag('documents')" @update:model-value="setFeatureFlag('documents', !!$event)">
            {{ $t('Documenten') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('audit-logs')" @update:model-value="setFeatureFlag('audit-logs', !!$event)">
            {{ $t('Logboek') }}
        </Checkbox>

        <Checkbox :model-value="!getFeatureFlag('disable-events')" @update:model-value="setFeatureFlag('disable-events', !$event)">
            {{ $t('Activiteiten') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('member-trials')" @update:model-value="setFeatureFlag('member-trials', !!$event)">
            {{ $t('Proefperiodes') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('balance-emails')" @update:model-value="setFeatureFlag('balance-emails', !!$event)">
            {{ $t('Notificaties voor openstaande bedragen') }}
        </Checkbox>

        <Checkbox :model-value="getFeatureFlag('event-notifications')" @update:model-value="setFeatureFlag('event-notifications', !!$event)">
            {{ $t('Kampmeldingen') }}
        </Checkbox>

        <Checkbox :model-value="!!STAMHOOFD.domains.webshop" :disabled="true">
            {{ $t('Webshops') }}
        </Checkbox>

        <hr><h2>{{ $t('Login methodes') }}</h2>

        <STList>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Password)" :label="$t(`Wachtwoord`)" @update:model-value="setLoginMethod(LoginMethod.Password, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Password)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.Google)" :label="$t(`Google`)" @update:model-value="setLoginMethod(LoginMethod.Google, !!$event)">
                <template #right>
                    <button class="button icon settings" type="button" @click="editLoginMethodConfig(LoginMethod.Google)" />
                </template>
            </CheckboxListItem>
            <CheckboxListItem :model-value="getLoginMethod(LoginMethod.SSO)" :label="$t(`Single-Sign-On (SSO)`)" @update:model-value="setLoginMethod(LoginMethod.SSO, !!$event)">
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
        new Toast($t(`De wijzigingen zijn opgeslagen`), 'success green').show();
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
