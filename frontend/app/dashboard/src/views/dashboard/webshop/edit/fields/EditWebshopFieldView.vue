<template>
    <SaveView :title="isNew ? $t(`Vraag toevoegen`) : $t(`Vraag bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('40b3b89e-4d82-4d6c-b49d-1e084802ee2e') }}
        </h1>
        <h1 v-else>
            {{ $t('18d8f60a-ec12-405e-b26a-ed9ba39fefe4') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`1539d481-12bf-4814-9fe3-3770eaecdda8`)">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('b230e824-be5c-45a0-b9c4-fc5f7688ec50') }}
        </p>

        <Checkbox v-model="required">
            {{ $t('c71e34a3-bffd-46a7-88d0-da3e95432130') }}
        </Checkbox>

        <template v-if="required">
            <STInputBox error-fields="placeholder" :error-box="errors.errorBox" :title="$t(`0c35caa6-6240-4a92-9d89-78acf2c79fc0`)+'*'">
                <input v-model="placeholder" class="input" type="text" autocomplete="off" :placeholder="$t(`caa8166a-c0cc-4579-97b9-b57fd7f0a00d`)">
            </STInputBox>
            <p class="style-description-small">
                * {{ $t("54855ccd-0723-4512-be9b-daf3341a3b2a") }}
            </p>
        </template>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('7b67c672-eb69-4f0f-903e-88b34c67e860') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { WebshopField } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    field: WebshopField;
    isNew: boolean;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: PatchableArrayAutoEncoder<WebshopField>) => void);
}>();

const errors = useErrors();
const { patched, addPatch, hasChanges } = usePatch(props.field);
const pop = usePop();

const name = computed({
    get: () => patched.value.name,
    set: (name: string) => {
        addPatch(WebshopField.patch({ name }));
    },
});

const required = computed({
    get: () => patched.value.required,
    set: (required: boolean) => {
        addPatch(WebshopField.patch({ required }));
    },
});

const description = computed({
    get: () => patched.value.description,
    set: (description: string) => {
        addPatch(WebshopField.patch({ description }));
    },
});

const placeholder = computed({
    get: () => patched.value.placeholder,
    set: (placeholder: string) => {
        addPatch(WebshopField.patch({ placeholder }));
    },
});

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }
    const p: PatchableArrayAutoEncoder<WebshopField> = new PatchableArray();
    p.addPatch(WebshopField.patch(Object.assign({}, patched.value, { id: props.field.id })));
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze vraag wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p: PatchableArrayAutoEncoder<WebshopField> = new PatchableArray();
    p.addDelete(props.field.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
