<template>
    <div class="st-view background">
        <STNavigationBar :title="template.settings.name" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 class="style-navigation-title">
                {{ template.settings.name }}
            </h1>

            <p v-if="isDraft" class="warning-box">
                Dit document is nog een kladversie. Nu kan je alles nog wijzigen, maar ze is nog niet zichtbaar voor leden. Publiceer het document via de knop onderaan nadat je alles hebt nagekeken.
            </p>
            <p v-else class="success-box">
                Dit document is zichtbaar in het ledenportaal.
            </p>

            <p v-if="!isDraft && template.updatesEnabled" class="warning-box">
                We raden aan om automatische wijzigingen uit te schakelen zodra alle documenten volledig zijn (of als leden voldoende kans hebben gehad om ontbrekende gegevens aan te vullen). Anders riskeer je dat documenten nog worden gewijzigd of verwijderd als leden worden uitgeschreven.
            </p>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="openDocuments">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/agreement.svg"></template>
                    <h2 class="style-title-list">
                        Documenten
                    </h2>
                    <p class="style-description">
                        Bekijk en bewerk de aangemaakte documenten.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem v-if="isDraft || template.updatesEnabled" :selectable="true" class="left-center" @click="editSettings">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/edit-data.svg"></template>
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        Wijzig de invulvelden en de instellingen van het document.
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>

                <STListItem v-if="!isDraft && xmlExportDescription" :selectable="true" class="left-center" @click="exportXml">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/code-export.svg"></template>
                    <h2 class="style-title-list">
                        Exporteren naar XML
                    </h2>
                    <p class="style-description">
                        {{ xmlExportDescription }}
                    </p>
                    <template #right><span class="icon arrow-right-small gray" /></template>
                </STListItem>
            </STList>

            <hr>
            <h2>Automatische wijzigingen</h2>
            <p>Stamhoofd kan de inhoud van documenten automatisch wijzigen als de daarbij horende gegevens wijzigen, en nieuwe documenten aanmaken als er nieuwe inschrijvingen bij komen (ook na publicatie). Dat is ideaal om bijvoorbeeld ontbrekende of foute gegevens door leden nog te laten invullen via het ledenportaal. Op het moment dat je documenten officiëel hebt ingedient (indien van toepassing), zet je dit best uit. Als dit uit staat zullen onvolledige documenten niet langer zichtbaar zijn voor leden.</p>

            <Checkbox :model-value="template.updatesEnabled" :disabled="settingUpdatesEnabled" @update:model-value="toggleUpdatesEnabled">
                Documenten automatisch wijzigen
            </Checkbox>

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
                    <template #right><button type="button" class="button secundary green hide-smartphone">
                        <span class="icon success" />
                        <span>Publiceer</span>
                    </button>                    <button type="button" class="button icon success only-smartphone" /></template>
                </STListItem>

                <STListItem v-if="!isDraft" :selectable="true" @click="draftTemplate()">
                    <h2 class="style-title-list">
                        Terug naar klad
                    </h2>
                    <p class="style-description">
                        Maak dit document terug onzichtbaar voor alle leden.
                    </p>
                    <template #right><button type="button" class="button secundary hide-smartphone">
                        <span class="icon edit" />
                        <span>Naar klad</span>
                    </button>                    <button type="button" class="button icon edit only-smartphone" /></template>
                </STListItem>

                <STListItem v-if="isDraft" :selectable="true" @click="deleteTemplate()">
                    <h2 class="style-title-list">
                        Document verwijderen
                    </h2>
                    <p class="style-description">
                        Verwijder alle documenten definitief.
                    </p>
                    <template #right><button type="button" class="button secundary danger hide-smartphone">
                        <span class="icon trash" />
                        <span>Verwijder</span>
                    </button>                    <button type="button" class="button icon trash only-smartphone" /></template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder,PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, FillRecordCategoryView, Spinner, STList, STListItem, STNavigationBar, Toast, TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { DocumentSettings, DocumentStatus, DocumentTemplatePrivate, RecordAnswer } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import DocumentsView from "./DocumentsView.vue";
import EditDocumentTemplateView from "./EditDocumentTemplateView.vue";


@Component({
    components: {
        STNavigationBar,
        STList,
        STListItem,
        Spinner,
        Checkbox
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
    settingUpdatesEnabled = false;

    async patchTemplate(patch: AutoEncoderPatchType<DocumentTemplatePrivate>) {
        const arr: PatchableArrayAutoEncoder<DocumentTemplatePrivate> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentTemplatePrivate>
        patch.id = this.template.id
        arr.addPatch(patch)

        try {
            const response = await this.$context.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/document-templates",
                body: arr,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                timeout: 5 * 60 * 1000,
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
    }

    async toggleUpdatesEnabled() {
        if (this.settingUpdatesEnabled) {
            return
        }
        const updatesEnabled = !this.template.updatesEnabled
        if (!(await CenteredMessage.confirm(updatesEnabled ? "Automatische wijzigingen aanzetten?" : "Automatische wijzigingen uitzetten?", updatesEnabled ? "Aanzetten" : "Uitzetten", updatesEnabled ? "Alle documenten zullen meteen worden bijgewerkt." : "Alle documenten zullen niet langer aangepast worden."))) {
            return
        }

        this.settingUpdatesEnabled = true

        await this.patchTemplate(DocumentTemplatePrivate.patch({
            updatesEnabled
        }));
        this.settingUpdatesEnabled = false
    }

    async changeStatus(status: DocumentStatus) {
        this.publishing = true

        await this.patchTemplate(DocumentTemplatePrivate.patch({
            status
        }));

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
            await this.$context.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/document-templates",
                body: patch,
                decoder: new ArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>),
                shouldRetry: false,
                timeout: 60 * 1000,
                owner: this
            })
            this.pop({force: true})
        } catch (e) {
            Toast.fromError(e).show()
        }
        this.deleting = false
    }

    exportXml() {
        // Start firing questions
        const c = this.gotoRecordCategory(0);
        if (c) {
            return this.present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: c
                    })
                ],
                modalDisplayStyle: "sheet"
            });
        }
    }

    async generateXML(): Promise<Blob> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const response = await this.$context.authenticatedServer.request({
            method: "GET",
            path: "/organization/document-templates/" + encodeURIComponent(this.template.id) + "/xml",
            shouldRetry: true,
            timeout: 5 * 60 * 1000,
            owner: this,
            responseType: "blob"
        })

        return response.data as Blob
    }

    async downloadXml() {
        try {
            const buffer = await this.generateXML()
            const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
            saveAs(buffer, Formatter.fileSlug(this.template.settings.name) + ".xml")
        } catch (e) {
            if (!Request.isAbortError(e)) {
                Toast.fromError(e).show()
            } else {
                new Toast('Downloaden geannuleerd', 'info').show()
            }
        }
    }

    gotoRecordCategory(index: number) {
        if (index >= this.template.privateSettings.templateDefinition.exportFieldCategories.length) {
            const pendingToast = new Toast("Aanmaken...", "spinner").setProgress(0).setHide(null).show()
            this.downloadXml().catch(console.error).finally(() => {
                pendingToast.hide()
            });
            return
        }

        const category = this.template.privateSettings.templateDefinition.exportFieldCategories[index]
        return new ComponentWithProperties(FillRecordCategoryView, {
            category,
            answers: this.template.settings.fieldAnswers,
            markReviewed: true,
            dataPermission: true,
            hasNextStep: index < this.template.privateSettings.templateDefinition.exportFieldCategories.length - 1,
            filterDefinitions: [],
            saveHandler: async (fieldAnswers: RecordAnswer[], component: NavigationMixin) => {
                await this.patchTemplate(DocumentTemplatePrivate.patch({
                    settings: DocumentSettings.patch({
                        fieldAnswers: fieldAnswers as any
                    })
                }));

                const c = this.gotoRecordCategory(index+1)
                if (!c) {
                    component.dismiss({force: true})
                    return
                }
                component.show(c)
            },
            filterValueForAnswers: (fieldAnswers: RecordAnswer[]) => {
                return this.template
            },
        })
    }

    get xmlExportDescription() {
        return this.template.privateSettings.templateDefinition.xmlExportDescription
    }
    
}
</script>