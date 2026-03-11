<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') " error-fields="name" :error-box="errors.errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') "
                >
            </STInputBox>
        </div>

        <STInputBox :title="$t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('930218d2-2e00-4d1f-90c9-59d77c1ed377')"
                autocomplete="off"
            />
        </STInputBox>

        <hr>
        <h2>{{ $t('1d742718-992d-4487-9c5e-a4ac46841a27') }}</h2>

        <STInputBox :title="$t('f9c5b001-dd96-4a70-82c7-505246f7be8c')" error-fields="maximum" :error-box="errors.errorBox">
            <NumberInput v-model="maximum" :placeholder="$t('3ef9e622-426f-4913-89a0-0ce08f4542d4')" :required="false" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('f3fc4e4d-76ee-4ca0-b712-9d2c7e5395fc') }}
        </p>

        <div class="split-inputs">
            <STInputBox :title="$t('93210fca-b5c6-431c-b109-736fe32b90ac')" error-fields="minimumDays" :error-box="errors.errorBox">
                <NumberInput v-model="minimumDays" :placeholder="$t('3ef9e622-426f-4913-89a0-0ce08f4542d4')" :required="false" />
            </STInputBox>

            <STInputBox :title="$t('08e038ea-805b-42bf-8755-6f6875aae836')" error-fields="maximumDays" :error-box="errors.errorBox">
                <NumberInput v-model="maximumDays" :placeholder="$t('104dca1f-f6eb-4193-ae27-5e5f96e4e481')" :required="false" />
            </STInputBox>
        </div>

        <Checkbox v-model="isLocationRequired">
            {{ $t('7a63f22a-1f4d-4dfa-9030-47137ff52bab') }}
            <p class="style-description-small">
                {{ $t('07963171-3e53-4aa7-b5f1-bce9470a62e9') }}
            </p>
        </Checkbox>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, NumberInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformEventType } from '@stamhoofd/structures';
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
const title = computed(() => props.isNew ? $t('9b76d069-ba68-4909-a084-ba74994c8b56') : $t('49a36bd7-3231-45da-a502-8f0cf83639f5'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
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

    if (!await CenteredMessage.confirm($t('24cdd0db-df35-4ef2-8230-7cade040fcfc'), $t('14f2d606-a7c9-4cdf-9ee9-aca38beb9689'), $t('dc8871b4-8d65-4247-9c2b-56e183cdf052'))) {
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

    return await CenteredMessage.confirm($t('1cb53933-ed06-45ae-9240-dd389298823c'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
