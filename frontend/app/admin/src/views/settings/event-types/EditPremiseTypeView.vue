<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%Gq') " error-fields="name" :error-box="errors.errorBox">
                <input v-model="name" class="input" type="text" :placeholder="$t('%Gq') ">
            </STInputBox>
        </div>

        <STInputBox :title="$t('%6o')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('%5r')" autocomplete="off" />
        </STInputBox>

        <hr><h2>{{ $t('%4R') }}</h2>

        <p class="style-description-small">
            {{ $t('%I0') }}
        </p>

        <div class="split-inputs">
            <NumberInputBox v-model="min" :title="$t('%5s')" error-fields="minimumDays" :error-box="errors.errorBox" :placeholder="$t('%1FW')" :required="false" :validator="errors.validator" />

            <NumberInputBox v-model="max" :title="$t('%dN')" error-fields="maximumDays" :error-box="errors.errorBox" :placeholder="$t('%4a')" :required="false" :validator="errors.validator" />
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { PlatformPremiseType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    type: PlatformPremiseType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformPremiseType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('%5t') : $t('%5u'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

const save = async () => {
    if (saving.value || deleting.value) {
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
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('%5v'), $t('%CJ'), $t('%5w'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const min = computed({
    get: () => patched.value.min,
    set: min => addPatch({ min }),
});

const max = computed({
    get: () => patched.value.max,
    set: max => addPatch({ max }),
});

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
