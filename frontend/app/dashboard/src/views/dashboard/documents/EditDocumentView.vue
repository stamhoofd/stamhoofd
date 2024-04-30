<template>
    <SaveView :title="title" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p class="warning-box">
            Als je hier gegevens wijzigt, zullen die gegevens van dit document niet meer automatisch gekoppeld zijn aan de gegevens van de bijhorende leden en inschrijvingen. Meestal is het beter om de gegevens rechtstreeks bij het lid of de inschrijving te wijzigen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox">
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

            <RecordAnswerInput v-for="record of category.filterRecords(true)" :key="record.id" :record-settings="record" :record-answers="editingAnswers" :validator="validator" />
        </div>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Document, DocumentData, DocumentTemplatePrivate, RecordCategory, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop, Watch } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STList,
        STListItem,
        SaveView,
        STInputBox,
        RecordAnswerInput,
        STErrorsDefault
    }
})
export default class EditDocumentView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        isNew!: boolean
    
    @Prop({ required: true })
        document!: Document

    @Prop({ required: true })
        template!: DocumentTemplatePrivate

    patchDocument = Document.patch({})
    validator = new Validator()
    errorBox: ErrorBox | null = null
    saving = false
    editingAnswers = this.document.data.fieldAnswers.map(a => a.clone())

    get patchedDocument() {
        return this.document.patch(this.patchDocument)
    }

    get definitions() {
        return RecordCategory.getRecordCategoryDefinitions([...this.template.privateSettings.templateDefinition.documentFieldCategories, ...this.template.privateSettings.templateDefinition.groupFieldCategories], () => this.editingAnswers)
    }

    get fieldCategories() {
        return RecordCategory.flattenCategories([...this.template.privateSettings.templateDefinition.documentFieldCategories, ...this.template.privateSettings.templateDefinition.groupFieldCategories], {} as any, this.definitions, true)
    }

    @Watch("editingAnswers")
    saveAnswers() {
        for (const answer of this.editingAnswers) {
            const previousAnswer = this.document.data.fieldAnswers.find(a => a.settings.id === answer.settings.id)
            if (!previousAnswer || previousAnswer.stringValue !== answer.stringValue) {
                answer.markReviewed()
            }
        }

        this.patchDocument = this.patchDocument.patch({
            data: DocumentData.patch({
                fieldAnswers: this.editingAnswers as any
            })
        })
    }

    get title() {
        return this.isNew ? "Nieuw document" : "Document bewerken"
    }

    get description() {
        return this.patchedDocument.data.description
    }

    set description(value: string) {
        this.patchDocument = this.patchDocument.patch({
            data: DocumentData.patch({
                description: value
            })
        })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchDocument, this.document, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    async validate() {
        // todo: validate information before continueing
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true

        try {
            // Make sure answers are updated
            this.saveAnswers();
            
            if (!await this.validator.validate()) {
                this.saving = false
                return
            }

            await this.validate()

            const patch: PatchableArrayAutoEncoder<Document> = new PatchableArray() as PatchableArrayAutoEncoder<Document>

            if (this.isNew) {
                patch.addPut(this.patchedDocument)
            } else {
                this.patchDocument.id = this.patchedDocument.id
                patch.addPatch(this.patchDocument)
            }

            const response = await this.$context.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/documents",
                body: patch,
                decoder: new ArrayDecoder(Document as Decoder<Document>),
                shouldRetry: false,
                owner: this
            })
            const updatedDocument = response.data[0]
            if (updatedDocument) {
                this.editingAnswers = this.document.data.fieldAnswers.map(a => a.clone())
                this.patchDocument = Document.patch({})
                this.document.set(updatedDocument)
            }
            
            this.dismiss({ force: true })
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }
}
</script>