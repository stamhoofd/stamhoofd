<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-policy-view" @save="save" v-on="!isNew && deleteHandler ? { delete: deleteMe } : {}">
        <h1>{{ title }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%1Os`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`%QD`)" autocomplete="off">
        </STInputBox>

        <STInputBox class="max" :title="$t(`%QE`)">
            <RadioGroup>
                <Radio v-model="selectedType" value="website">
                    {{ $t('%QB') }}
                </Radio>
                <Radio v-model="selectedType" value="file">
                    {{ $t('%QC') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedType === 'website'" key="website" error-fields="url" :error-box="errors.errorBox" :title="$t(`%IL`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('%2l')">
        </STInputBox>

        <FileInput v-if="selectedType === 'file'" key="file" v-model="file" :validator="errors.validator" :required="false" :title="$t(`%OZ`)" />
    </SaveView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@common/encoding';
import { SimpleError } from '@common/errors';
import { usePop } from '@browser/navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import FileInput from '@stamhoofd/components/inputs/FileInput.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import type { File } from '@stamhoofd/structures';
import { Policy } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    policy: Policy;
    isNew: boolean;
    saveHandler: (patch: AutoEncoderPatchType<Policy>) => void;
    deleteHandler?: () => void;
}>();

const errors = useErrors();
const pop = usePop();
const title = props.isNew ? $t('%Zzu') : $t('%ZzB');

const { patch, patched, addPatch, hasChanges } = usePatch(props.policy);

const selectedType = ref(props.policy.file ? 'file' : 'website');

const name = computed({
    get: () => patched.value.name,
    set: (name: string) => {
        addPatch(Policy.patch({ name }));
    },
});

const url = computed({
    get: () => patched.value.url,
    set: (url: string | null) => {
        addPatch(Policy.patch({ url }));
    },
});

const file = computed({
    get: () => patched.value.file,
    set: (file: File | null) => {
        addPatch(Policy.patch({ file }));
    },
});

function validate() {
    if (selectedType.value === 'file') {
        // The url has priority over the file. Keep the file when a url is chosen, so it doesn't need a new upload when switching back
        url.value = null;
        if (!file.value) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'No file selected',
                human: $t('%Zou'),
            });
        }
        return;
    }

    if (!url.value) {
        throw new SimpleError({
            code: 'invalid_field',
            message: 'Invalid url',
            human: $t('%Zp5'),
            field: 'url',
        });
    }

    if (!url.value.startsWith('http://') && !url.value.startsWith('https://') && !url.value.startsWith('mailto:') && !url.value.startsWith('tel:')) {
        url.value = 'http://' + url.value;
    }
}

async function save() {
    try {
        validate();
        if (!await errors.validator.validate()) {
            return;
        }
        props.saveHandler(patch.value);
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm({
        title: name.value ? $t('%Zn2', { name: name.value }) : $t('Deze link verwijderen?'),
        confirmText: $t('%CJ'),
        description: $t('%ZyX'),
        availabilityDelay: 2_000,
    })) {
        return;
    }
    props.deleteHandler?.();
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
}

defineExpose({
    shouldNavigateAway,
});
</script>
