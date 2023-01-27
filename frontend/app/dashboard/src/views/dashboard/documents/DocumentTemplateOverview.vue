<template>
    <div class="st-view background">
        <STNavigationBar :title="template.privateSettings.templateDefinition.name" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 class="style-navigation-title">
                {{ template.privateSettings.templateDefinition.name }}
            </h1>

            <p v-if="isDraft" class="warning-box">
                Dit document is nog een kladversie. Nu kan je alles nog wijzigen, maar ze is nog niet zichtbaar voor leden. Publiceer het document via de knop onderaan nadat je alles hebt nagekeken.
            </p>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openDocuments">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/agreement.svg">
                    <h2 class="style-title-list">
                        Documenten
                    </h2>
                    <p class="style-description">
                        Bekijk en bewerk de aangemaakte documenten.
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" class="left-center" @click="editSettings">
                    <img slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        Wijzig de invulvelden en de instellingen van het document.
                    </p>
                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>

            <hr>
            <h2>Acties</h2>

            <STList>
                <STListItem v-if="isDraft" :selectable="true" @click="publishTemplate()">
                    <h2 class="style-title-list">
                        Document publiceren
                    </h2>
                    <p class="style-description">
                        Maak alle documenten toegankelijk voor alle leden.
                    </p>
                    <button slot="right" type="button" class="button secundary green hide-smartphone">
                        <span class="icon success" />
                        <span>Publiceer</span>
                    </button>
                    <button slot="right" type="button" class="button icon success only-smartphone" />
                </STListItem>

                <STListItem v-if="!isDraft" :selectable="true" @click="draftTemplate()">
                    <h2 class="style-title-list">
                        Terug naar klad
                    </h2>
                    <p class="style-description">
                        Maak dit document terug onzichtbaar voor alle leden.
                    </p>
                    <button slot="right" type="button" class="button secundary hide-smartphone">
                        <span class="icon edit" />
                        <span>Naar klad</span>
                    </button>
                    <button slot="right" type="button" class="button icon edit only-smartphone" />
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" @click="deleteTemplate()">
                    <h2 class="style-title-list">
                        Document verwijderen
                    </h2>
                    <p class="style-description">
                        Verwijder alle documenten definitief.
                    </p>
                    <button slot="right" type="button" class="button secundary danger hide-smartphone">
                        <span class="icon trash" />
                        <span>Verwijder</span>
                    </button>
                    <button slot="right" type="button" class="button icon trash only-smartphone" />
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder,PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Spinner, STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { DocumentStatus, DocumentTemplatePrivate } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import DocumentsView from "./DocumentsView.vue";
import EditDocumentTemplateView from "./EditDocumentTemplateView.vue";


@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        Spinner
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class DocumentTemplateOverview extends Mixins(NavigationMixin) {
    @Prop({required: true})
        template: DocumentTemplatePrivate

    deleting = false
    publishing = false

    openDocuments() {
        this.show({
            components: [
                new ComponentWithProperties(DocumentsView, {
                    template: this.template
                })
            ]
        })
    }

    editSettings() {
        this.present({
            components: [
                new ComponentWithProperties(EditDocumentTemplateView, {
                    isNew: false,
                    document: this.template
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    get isDraft() {
        return this.template.status === DocumentStatus.Draft
    }

    async publishTemplate() {
        if (this.publishing) {
            return
        }

        if (!(await CenteredMessage.confirm("Ben je zeker dat je alle documenten wilt publiceren?", "Publiceren", "Je kan de documenten hierna niet meer bewerken, en ze zijn zichtbaar voor alle leden."))) {
            return
        }
        await this.changeStatus(DocumentStatus.Published)
    }

    async draftTemplate() {
        if (this.publishing) {
            return
        }

        if (!(await CenteredMessage.confirm("Ben je zeker dat je alle documenten weer wilt verbergen?", "Verbergen", "Leden zullen de documenten opeens niet meer kunnen bekijken."))) {
            return
        }
        await this.changeStatus(DocumentStatus.Draft)
    }

    async changeStatus(status: DocumentStatus) {
        this.publishing = true

        const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>
        patch.addPatch(DocumentTemplatePrivate.patch({
            id: this.template.id,
            status
        }))

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/document-templates",
                body: patch,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                owner: this
            })
            const documentTemplates = response.data
            const template = documentTemplates.find(t => t.id == this.template.id)
            if (template) {
                this.template.set(template)
            }
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.publishing = false
    }

    async deleteTemplate() {
        if (this.deleting) {
            return
        }

        if (!(await CenteredMessage.confirm("Ben je zeker dat je alle documenten wilt verwijderen?", "Verwijderen", "Verwijder nooit officiële documenten!"))) {
            return
        }
        this.deleting = true

        const patch: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>
        patch.addDelete(this.template.id)

        try {
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/document-templates",
                body: patch,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                owner: this
            })
            this.pop({force: true})
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.deleting = false
    }
    
}
</script>