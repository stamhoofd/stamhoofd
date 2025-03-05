<template>
    <div class="container">
        <hr><h2 class="style-with-button">
            <div>{{ $t('21844c74-0d66-4d5a-8d90-06502b2a7955') }} {{ policy.name || "Naamloos" }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="emits('delete')">
                    <span class="icon trash"/>
                    <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                </button>
            </div>
        </h2>

        <STInputBox :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`8706b706-b967-4136-88ba-e96838fd95b3`)" autocomplete="off"></STInputBox>

        <STInputBox error-fields="privacy" :error-box="errorBox" class="max" :title="$t(`8e34f68e-607c-4cb5-9a74-70c4984c0226`)">
            <RadioGroup>
                <Radio v-model="selectedType" value="website">
                    {{ $t('e6445264-fcbf-4ff8-b7cb-9b08338e2a0c') }}
                </Radio>
                <Radio v-model="selectedType" value="file">
                    {{ $t('b503f475-efd9-4413-a792-8230b0663d84') }}
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedType === 'website'" key="website" error-fields="url" :error-box="errorBox" :title="$t(`82530bca-53e8-4dc7-b04b-dc520853efc8`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('daf8a992-77cd-4c20-8bca-5c692fd1e431')"></STInputBox>

        <FileInput v-if="selectedType === 'file'" key="file" v-model="file" :validator="validator" :required="false" :title="$t(`6ef890af-c906-448d-9e38-a65643a0501e`)"/>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, FileInput, Radio, RadioGroup, STInputBox, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { File, Policy } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
    errorBox: ErrorBox | null;
    validator: Validator;
    policy: Policy;
}>(), {
    errorBox: null,
});

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<Policy>): void;
    (e: 'delete'): void;
}>();

const selectedType = ref(props.policy.file ? 'file' : 'website');

const name = computed({
    get: () => props.policy.name,
    set: (name: string) => {
        emits('patch', Policy.patch({ name }));
    },
});

const url = computed({
    get: () => props.policy.url,
    set: (url: string | null) => {
        emits('patch', Policy.patch({ url }));
    },
});

const file = computed({
    get: () => props.policy.file,
    set: (file: File | null) => {
        emits('patch', Policy.patch({ file }));
    },
});

const errors = useErrors({ validator: props.validator });
useValidation(errors.validator, () => {
    return validate();
});

function validate() {
    // TODO: add validator
    if (selectedType.value === 'file') {
        url.value = null;
        // We don't clear the file if url is selected, since url has priority over the file. So we don't need to reupload the file
        if (!file.value) {
            throw new SimpleError({
                code: '',
                message: 'Selecteer een bestand',
            });
        }
    }
    else {
        if (!url.value) {
            throw new SimpleError({
                code: '',
                message: 'Vul een geldige link in',
            });
        }
    }

    if (selectedType.value === 'website' && props.policy.url && props.policy.url.length > 0 && !props.policy.url.startsWith('http://') && !props.policy.url.startsWith('https://') && !props.policy.url.startsWith('mailto:') && !props.policy.url.startsWith('tel:')) {
        url.value = 'http://' + props.policy.url;
    }
    return true;
}
</script>
