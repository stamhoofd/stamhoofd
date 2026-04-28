<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%1Os') " error-fields="name" :error-box="errors.errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('%1Os') "
                >
            </STInputBox>
        </div>

        <STInputBox :title="$t('%6o')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('%4b')"
                autocomplete="off"
            />
        </STInputBox>

        <hr>
        <h2>{{ $t('%4R') }}</h2>

        <NumberInputBox v-model="maximum" :title="$t('%4T')" error-fields="maximum" :validator="errors.validator" :error-box="errors.errorBox" :placeholder="$t('%1FW')" :required="false" />

        <p class="style-description-small">
            {{ $t('%5m') }}
        </p>

        <div class="split-inputs">
            <NumberInputBox v-model="minimumDays" :title="$t('%4V')" error-fields="minimumDays" :validator="errors.validator" :error-box="errors.errorBox" :placeholder="$t('%1FW')" :required="false" />

            <NumberInputBox v-model="maximumDays" :title="$t('%4U')" error-fields="maximumDays" :validator="errors.validator" :error-box="errors.errorBox" :placeholder="$t('%4a')" :required="false" :min="minimumDays ? minimumDays + 1 : null" />
        </div>

        <Checkbox v-model="isLocationRequired">
            {{ $t('%6J') }}
            <p class="style-description-small">
                {{ $t('%6K') }}
            </p>
        </Checkbox>
    </SaveView>
</template>

<script setup lang="ts">
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { PlatformEventType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    type: PlatformEventType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformEventType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('%5n') : $t('%5o'));
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

    if (!await CenteredMessage.confirm($t('%5p'), $t('%CJ'), $t('%5q'))) {
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

const maximum = computed({
    get: () => patched.value.maximum,
    set: maximum => addPatch({ maximum }),
});

const minimumDays = computed({
    get: () => patched.value.minimumDays,
    set: minimumDays => addPatch({ minimumDays }),
});

const maximumDays = computed({
    get: () => patched.value.maximumDays,
    set: maximumDays => addPatch({ maximumDays }),
});

const isLocationRequired = computed({
    get: () => patched.value.isLocationRequired,
    set: isLocationRequired => addPatch({ isLocationRequired }),
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
