<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" :title="$t(`4f208599-c312-48ba-905b-320cacf05708`)" @save="save">
        <h1>
            {{ $t('c5b0dabc-db2d-4a17-b805-1f1db9a5aa0f', {method: loginMethod}) }}
        </h1>
        <p>
            {{ $t('7109c9f9-d44a-4d0e-a56a-7193f9218bd7') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="fullName" :error-box="errors.errorBox" :title="$t(`e4b3d2af-dee8-4f55-88e9-a229513d347c`)">
            <input ref="firstInput" v-model="fullName" class="input" type="text" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)">
        </STInputBox>

        <STInputBox error-fields="shortName" :error-box="errors.errorBox" :title="$t(`8bc9dc7d-7dba-4712-9e4d-c3a64c43cb26`)">
            <input ref="firstInput" v-model="shortName" class="input" type="text" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)">
        </STInputBox>

        <STInputBox error-fields="loginButtonText" :error-box="errors.errorBox" :title="$t(`6fa093d9-7a49-4007-8b73-446d04d3fd12`)">
            <input ref="firstInput" v-model="loginButtonText" class="input" type="text" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)">
        </STInputBox>

        <ArrayInput v-model="allowlist" :default-value="() => ''" :title="$t(`0999529a-9b4f-417a-95da-120f5daabf24`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`30e5c996-ef97-4ad6-8503-049163cd197d`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('49b896d1-9e3c-4a5b-bb35-88cdf9febbf3') }}
                </p>
            </template>
        </ArrayInput>
        <p v-if="allowlist.length" class="style-description-small">
            {{ $t('64542640-1f4f-4f9f-a277-86ccbd69d2a9') }}
        </p>

        <ArrayInput v-model="blocklist" :default-value="() => ''" :title="$t(`56bf5802-724f-451b-8ed4-533cd46fbbe2`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`30e5c996-ef97-4ad6-8503-049163cd197d`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('2954282d-0883-48ed-b677-98f8b865b2ca') }}
                </p>
            </template>
        </ArrayInput>
        <p class="style-description-small">
            {{ $t('d346b6d1-87e5-452d-a3c2-b1f0e41acedb') }}
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
