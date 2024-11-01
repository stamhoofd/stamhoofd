<template>
    <SaveView :title="title" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p class="warning-box">
            Als je hier gegevens wijzigt, zullen die gegevens van dit document niet meer automatisch gekoppeld zijn aan de gegevens van de bijhorende leden en inschrijvingen. Meestal is het beter om de gegevens rechtstreeks bij het lid of de inschrijving te wijzigen.
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errors.errorBox">
            <input
                v-model="description"
                class="input"
                type="text"
                placeholder="Beschrijving document"
            >
        </STInputBox>

        <div v-for="category of fieldCategories" :key="category.id" class="container">
            <hr>
            <h2>{{ category.name }}</h2>
            <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

            <!-- todo: should records be filtered? -->
            <RecordAnswerInput v-for="record of category.records" :key="record.id" :record="record" :answers="editingAnswers" :validator="errors.validator" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, useContext, useErrors, usePatch } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Document, DocumentData, DocumentTemplatePrivate, RecordCategory } from '@stamhoofd/structures';
import { computed, ComputedRef, ref, watch } from 'vue';

const props = defineProps<{
    isNew: boolean;
    document: Document;
    template: DocumentTemplatePrivate;
}>();

const requestOwner = useRequestOwner();
const context = useContext();
const { patch: patchDocument, patched: patchedDocument, hasChanges } = usePatch(props.document);
const errors = useErrors();
const dismiss = useDismiss();
const saving = ref(false);
const editingAnswers = ref(cloneMap(props.document.data.fieldAnswers));

// get definitions() {
//     return [];
// }

const fieldCategories = computed(() => {
    return RecordCategory.flattenCategories([...props.template.privateSettings.templateDefinition.documentFieldCategories, ...props.template.privateSettings.templateDefinition.groupFieldCategories], {} as any);
}) as ComputedRef<RecordCategory[]>;

function saveAnswers() {
    for (const answer of editingAnswers.value.values()) {
        const previousAnswer = props.document.data.fieldAnswers.get(answer.settings.id);
        if (!previousAnswer || previousAnswer.stringValue !== answer.stringValue) {
            answer.markReviewed();
        }
    }

    patchDocument.value = patchDocument.value.patch({
        data: DocumentData.patch({
            fieldAnswers: editingAnswers.value as any,
        }),
    });
}

watch(editingAnswers, () => saveAnswers());

const title = props.isNew ? 'Nieuw document' : 'Document bewerken';
const description = computed(() => patchedDocument.value.data.description);

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

async function validate() {
    // todo: validate information before continueing
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        // Make sure answers are updated
        saveAnswers();

        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }

        await validate();

        const patch: PatchableArrayAutoEncoder<Document> = new PatchableArray() as PatchableArrayAutoEncoder<Document>;

        if (props.isNew) {
            patch.addPut(patchedDocument.value);
        }
        else {
            patchDocument.value.id = patchedDocument.value.id;
            patch.addPatch(patchDocument.value);
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/documents',
            body: patch,
            decoder: new ArrayDecoder(Document as Decoder<Document>),
            shouldRetry: false,
            owner: requestOwner,
        });
        const updatedDocument = response.data[0];
        if (updatedDocument) {
            editingAnswers.value = cloneMap(props.document.data.fieldAnswers);
            patchDocument.value = Document.patch({});
            props.document.deepSet(updatedDocument);
        }

        dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

function cloneMap<K, T extends AutoEncoder>(map: Map<K, T>): Map<K, T> {
    return new Map([...map.entries()]
        .map(([key, value]) => [key, value.clone()]));
}

defineExpose({
    shouldNavigateAway,
});
</script>
