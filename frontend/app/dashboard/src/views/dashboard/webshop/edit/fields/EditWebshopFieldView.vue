<template>
    <SaveView :title="isNew ? $t(`%Se`) : $t(`%Sf`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('%Se') }}
        </h1>
        <h1 v-else>
            {{ $t('%Sf') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`%Sk`)">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`%14p`)" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%Sg') }}
        </p>

        <Checkbox v-model="required">
            {{ $t('%Sh') }}
        </Checkbox>

        <template v-if="required">
            <STInputBox error-fields="placeholder" :error-box="errors.errorBox" :title="$t(`%Q`)+'*'">
                <input v-model="placeholder" class="input" type="text" autocomplete="off" :placeholder="$t(`%Sl`)">
            </STInputBox>
            <p class="style-description-small">
                * {{ $t("%Sj") }}
            </p>
        </template>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%Si') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
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
