<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" :title="$t(`Login methode configuratie`)" @save="save">
        <h1>
            {{ $t('Login methode configuratie ({method})', {method: loginMethod}) }}
        </h1>
        <p>
            {{ $t('Bepaal de voorwaarden en benamign van deze login methode.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="fullName" :error-box="errors.errorBox" :title="$t(`Volledige naam`)">
            <input ref="firstInput" v-model="fullName" class="input" type="text" autocomplete="off" :placeholder="$t(`Optioneel`)">
        </STInputBox>

        <STInputBox error-fields="shortName" :error-box="errors.errorBox" :title="$t(`Korte naam`)">
            <input ref="firstInput" v-model="shortName" class="input" type="text" autocomplete="off" :placeholder="$t(`Optioneel`)">
        </STInputBox>

        <STInputBox error-fields="loginButtonText" :error-box="errors.errorBox" :title="$t(`Login knop text`)">
            <input ref="firstInput" v-model="loginButtonText" class="input" type="text" autocomplete="off" :placeholder="$t(`Optioneel`)">
        </STInputBox>

        <ArrayInput v-model="allowlist" :default-value="() => ''" :title="$t(`Toegestane domeinnamen`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`Domeinnaam`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('Alle emaildomeinnamen zijn toegestaan') }}
                </p>
            </template>
        </ArrayInput>
        <p v-if="allowlist.length" class="style-description-small">
            {{ $t('Enkel e-mailadressen met deze domeinnamen kunnen deze login methode gebruiken.') }}
        </p>

        <ArrayInput v-model="blocklist" :default-value="() => ''" :title="$t(`Uitgesloten domeinnamen`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`Domeinnaam`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('Geen uitgesloten domeinnamen') }}
                </p>
            </template>
        </ArrayInput>
        <p class="style-description-small">
            {{ $t('E-mailadressen met deze domeinnamen kunnen deze login methode niet gebruiken.') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, ConvertArrayToPatchableArray, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ArrayInput, CenteredMessage, ErrorBox, useErrors, usePatchMap } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { LoginMethod, LoginMethodConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        loginMethod: LoginMethod;
        configs: Map<LoginMethod, LoginMethodConfig>;
        saveHandler: (config: ConvertArrayToPatchableArray<Map<LoginMethod, LoginMethodConfig>>) => Promise<void>;
    }>(), {
    },
);

const { patch, patched: patchedConfigs, addPatch: addConfigsPatch, hasChanges } = usePatchMap(props.configs);

const patched = computed(() => patchedConfigs.value.get(props.loginMethod) ?? new LoginMethodConfig());

function addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<LoginMethodConfig>>) {
    addConfigsPatch(props.loginMethod, LoginMethodConfig.patch(patch));
}

const errors = useErrors();
const pop = usePop();
const $t = useTranslate();

const saving = ref(false);

const loginButtonText = computed({
    get: () => patched.value.loginButtonText ?? '',
    set: loginButtonText => addPatch({ loginButtonText: loginButtonText || null }),
});

const fullName = computed({
    get: () => patched.value.fullName ?? '',
    set: fullName => addPatch({ fullName: fullName || null }),
});

const shortName = computed({
    get: () => patched.value.shortName ?? '',
    set: shortName => addPatch({ shortName: shortName || null }),
});

const allowlist = computed({
    get: () => patched.value.allowlist,
    set: allowlist => addPatch({ allowlist: allowlist as any }),
});

const blocklist = computed({
    get: () => patched.value.blocklist,
    set: blocklist => addPatch({ blocklist: blocklist as any }),
});

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
        await props.saveHandler(patch.value);

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
