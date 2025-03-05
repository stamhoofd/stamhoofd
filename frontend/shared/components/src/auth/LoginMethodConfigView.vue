<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" @save="save" :title="$t(`a955a62b-30bf-4016-a683-c92237e0a81a`)">
        <h1>
            {{ $t('ad51f193-b048-40f2-9e7f-8026c535ce7d') }}{{ loginMethod }})
        </h1>
        <p>
            {{ $t('f12c4445-7102-4ddb-9a51-68ac6486640b') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox error-fields="fullName" :error-box="errors.errorBox" :title="$t(`feaaa12f-fe3e-4367-bc67-856d3179a099`)">
            <input ref="firstInput" v-model="fullName" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"></STInputBox>

        <STInputBox error-fields="shortName" :error-box="errors.errorBox" :title="$t(`73fdd704-c075-40af-a2b2-15a8025e9855`)">
            <input ref="firstInput" v-model="shortName" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"></STInputBox>

        <STInputBox error-fields="loginButtonText" :error-box="errors.errorBox" :title="$t(`74914947-6573-4427-88bf-1dad51f9c05a`)">
            <input ref="firstInput" v-model="loginButtonText" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"></STInputBox>

        <ArrayInput v-model="allowlist" :default-value="() => ''" :title="$t(`5bba2ed9-616e-4c1c-8968-52e60a422b20`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`838c80f3-bf67-48eb-9475-5ac3a45ad28e`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')"></template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('a7c15c98-49a4-4e86-8017-82dcc0dacb73') }}
                </p>
            </template>
        </ArrayInput>
        <p v-if="allowlist.length" class="style-description-small">
            {{ $t('07f0c306-5fa0-4d64-9e4a-30b377f28c79') }}
        </p>

        <ArrayInput v-model="blocklist" :default-value="() => ''" :title="$t(`bb11d0ad-a876-457c-8465-3f36d51cc546`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`838c80f3-bf67-48eb-9475-5ac3a45ad28e`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')"></template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('a20194f1-3708-4e28-b0c0-f8c801e9d5e0') }}
                </p>
            </template>
        </ArrayInput>
        <p class="style-description-small">
            {{ $t('c3825a47-e007-4399-a75a-de5bd22ebd58') }}
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
