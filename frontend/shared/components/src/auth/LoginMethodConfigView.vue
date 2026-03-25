<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :error-box="errors.errorBox" :title="$t(`%Ze`)" @save="save">
        <h1>
            {{ $t('%ZY', {method: loginMethod}) }}
        </h1>
        <p>
            {{ $t('%ZZ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="fullName" :error-box="errors.errorBox" :title="$t(`%10H`)">
            <input ref="firstInput" v-model="fullName" class="input" type="text" autocomplete="off" :placeholder="$t(`%14p`)">
        </STInputBox>

        <STInputBox error-fields="shortName" :error-box="errors.errorBox" :title="$t(`%Zf`)">
            <input ref="firstInput" v-model="shortName" class="input" type="text" autocomplete="off" :placeholder="$t(`%14p`)">
        </STInputBox>

        <STInputBox error-fields="loginButtonText" :error-box="errors.errorBox" :title="$t(`%Zg`)">
            <input ref="firstInput" v-model="loginButtonText" class="input" type="text" autocomplete="off" :placeholder="$t(`%14p`)">
        </STInputBox>

        <ArrayInput v-model="allowlist" :default-value="() => ''" :title="$t(`%Zh`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`%NE`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('%Za') }}
                </p>
            </template>
        </ArrayInput>
        <p v-if="allowlist.length" class="style-description-small">
            {{ $t('%Zb') }}
        </p>

        <ArrayInput v-model="blocklist" :default-value="() => ''" :title="$t(`%Zi`)">
            <template #item="{index, modelValue, updateModelValue}">
                <input :value="modelValue" class="input" type="text" :placeholder="$t(`%NE`) + ' ' + (index + 1)" autocomplete="off" @input="updateModelValue(($event.target as HTMLInputElement).value || '')">
            </template>

            <template #empty>
                <p class="style-description-small">
                    {{ $t('%Zc') }}
                </p>
            </template>
        </ArrayInput>
        <p class="style-description-small">
            {{ $t('%Zd') }}
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatchMap } from '#hooks/usePatchMap.ts';
import ArrayInput from '#inputs/ArrayInput.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import type { AutoEncoderPatchType, ConvertArrayToPatchableArray, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import type { LoginMethod} from '@stamhoofd/structures';
import { LoginMethodConfig } from '@stamhoofd/structures';
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
