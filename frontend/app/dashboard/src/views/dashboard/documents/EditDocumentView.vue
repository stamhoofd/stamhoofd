<template>
    <SaveView :title="title" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p class="warning-box">
            {{ $t('72b7fa7d-5f0f-4cca-b62e-c86495610edf') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <input v-model="description" class="input" type="text" :placeholder="$t(`fe417724-5dbd-4310-b7a1-232ab6fb63e6`)">
        </STInputBox>

        <div v-for="category of fieldCategories" :key="category.id" class="container">
            <hr><h2>{{ category.name }}</h2>
            <p v-if="category.description" class="style-description pre-wrap" v-text="category.description" />

            <!-- todo: should records be filtered? -->
            <RecordAnswerInput v-for="record of category.records" :key="record.id" :record="record" :answers="answers" :validator="errors.validator" @patch="patchAnswers" />
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, useContext, useErrors, usePatch } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Document, DocumentData, DocumentTemplatePrivate, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ComputedRef, ref } from 'vue';

const props = defineProps<{
    isNew: boolean;
    document: Document;
    template: DocumentTemplatePrivate;
}>();

const requestOwner = useRequestOwner();
const context = useContext();
const { patch: patchDocument, patched: patchedDocument, hasChanges, addPatch } = usePatch(props.document);
const errors = useErrors();
const dismiss = useDismiss();
const saving = ref(false);

const fieldCategories = computed(() => {
    return RecordCategory.flattenCategories([...props.template.privateSettings.templateDefinition.documentFieldCategories, ...props.template.privateSettings.templateDefinition.groupFieldCategories], props.document);
}) as ComputedRef<RecordCategory[]>;

function markReviewed() {
    for (const answer of answers.value.values()) {
        const previousAnswer = props.document.data.fieldAnswers.get(answer.settings.id);
        if (!previousAnswer || previousAnswer.stringValue !== answer.stringValue) {
            answer.markReviewed();
        }
    }
}

const title = props.isNew ? 'Nieuw document' : 'Document bewerken';
const description = computed({
    get: () => patchedDocument.value.data.description,
    set: (value) => {
        addPatch({
            data: DocumentData.patch({
                description: value,
            }),
        });
    },
});
const answers = computed(() => patchedDocument.value.data.fieldAnswers);

function patchAnswers(patch: PatchAnswers) {
    addPatch({
        data: DocumentData.patch({
            fieldAnswers: patch,
        }),
    });
}

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
        markReviewed();

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

defineExpose({
    shouldNavigateAway,
});
</script>
