<template>
    <SaveView :title="isNew ? $t(`Vraag toevoegen`) : $t(`Vraag bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('6d42620d-8193-424f-9f09-f527334566ce') }}
        </h1>
        <h1 v-else>
            {{ $t('2e79ca89-7687-4c53-91e4-9982a6b8f8e3') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`a9d8f27c-b4d3-415a-94a4-2ec3c018ee48`)"></STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('708bc4a3-6d4e-4e66-a41c-1243212163aa') }}
        </p>

        <Checkbox v-model="required">
            {{ $t('b4171b2e-5a72-4eb5-a6b5-f01f6d2c6697') }}
        </Checkbox>

        <template v-if="required">
            <STInputBox error-fields="placeholder" :error-box="errors.errorBox" :title="$t(`80c5af8f-19a2-4bfb-b8e7-b5b91e7d27c8`)">
                <input v-model="placeholder" class="input" type="text" autocomplete="off" :placeholder="$t(`c6fe3ba2-4f0a-4895-8c99-872f29f5b9b6`)"></STInputBox>
            <p class="style-description-small">
                {{ $t("f08fe6a9-61b6-47d3-af75-4c0334055a7c") }}
            </p>
        </template>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('e7af0898-3954-44fb-abe0-08f881e64bc9') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
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
