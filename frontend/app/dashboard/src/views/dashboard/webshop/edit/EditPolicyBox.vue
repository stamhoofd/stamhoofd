<template>
    <div class="container">
        <hr>
        <h2 class="style-with-button">
            <div>Externe link: {{ policy.name || "Naamloos" }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="emits('delete')">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
            </div>
        </h2>

        <STInputBox title="Naam">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                :placeholder="'bv. Contact'"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Naar waar wijst deze link?" error-fields="privacy" :error-box="errorBox" class="max">
            <RadioGroup>
                <Radio v-model="selectedType" value="website">
                    Naar een website
                </Radio>
                <Radio v-model="selectedType" value="file">
                    Naar een PDF-bestand
                </Radio>
            </RadioGroup>
        </STInputBox>

        <STInputBox v-if="selectedType === 'website'" key="website" title="Volledige link" error-fields="url" :error-box="errorBox">
            <input
                v-model="url"
                class="input"
                type="url"
                :placeholder="$t('daf8a992-77cd-4c20-8bca-5c692fd1e431')"
            >
        </STInputBox>

        <FileInput v-if="selectedType === 'file'" key="file" v-model="file" title="Kies een bestand" :validator="validator" :required="false" />
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
