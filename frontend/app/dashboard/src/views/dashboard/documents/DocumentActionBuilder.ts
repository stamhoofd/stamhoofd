import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"
import { CenteredMessage, LoadComponent, TableAction, Toast } from "@stamhoofd/components"
import { NetworkManager, SessionManager } from "@stamhoofd/networking"
import { Document, DocumentData, DocumentStatus, DocumentTemplatePrivate } from "@stamhoofd/structures"
import { Formatter } from "@stamhoofd/utility"
import { v4 as uuidv4 } from "uuid"

export class DocumentActionBuilder {
    component: any
    template: DocumentTemplatePrivate
    addDocument?: (document: Document) => void

    constructor(settings: {
        component: any,
        template: DocumentTemplatePrivate,
        addDocument?: (document: Document) => void
    }) {
        this.component = settings.component
        this.template = settings.template
        this.addDocument = settings.addDocument
    }

    getActions() {
        return [
            new TableAction({
                name: "Downloaden",
                icon: "download",
                priority: 5,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (documents: Document[]) => {
                    await this.downloadDocument(documents[0])
                }
            }),

            new TableAction({
                name: "Wijzig",
                icon: "edit",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: async (documents: Document[]) => {
                    await this.editDocument(documents[0])
                }
            }),

            new TableAction({
                name: "Dupliceren",
                icon: "copy",
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                allowAutoSelectAll: false,
                handler: async (documents: Document[]) => {
                    await this.duplicateDocument(documents[0])
                }
            }),

            new TableAction({
                name: "Verwijderen",
                icon: "trash",
                priority: 1,
                groupIndex: 3,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (documents: Document[]) => {
                    await this.deleteDocuments(documents)
                }
            })
        ]
    }

    async editDocument(document: Document) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditDocumentView" */ "./EditDocumentView.vue"), {
            document,
            template: this.template,
            isNew: false
        });
        this.component.present(displayedComponent.setDisplayStyle("popup"));
    }

    async deleteDocuments(documents: Document[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? `${documents.length} documenten verwijderen?` : "Dit document verwijderen?", "Verwijderen"))) {
            return;
        }
        try {
            const patch: PatchableArrayAutoEncoder<Document> = new PatchableArray() as PatchableArrayAutoEncoder<Document>
            for (const document of documents) {
                patch.addPatch(Document.patch({
                    id: document.id,
                    status: DocumentStatus.Deleted
                }))
            }
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                body: patch,
                path: "/organization/documents",
                shouldRetry: false,
                owner: this.component,
                decoder: new ArrayDecoder(Document as Decoder<Document>)
            })
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id)
                if (originalDocument) {
                    originalDocument.set(d)
                }
            }
            new Toast(documents.length === 1 ? "Document verwijderd" : `${documents.length} documenten verwijderd`, 'success').show()
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async duplicateDocument(document: Document) {
        if (!(await CenteredMessage.confirm("Dit document dupliceren?", "Dupliceren", "Gebruik dit als je hetzelfde attest in verschillende versies wilt beschikbaar maken aan hetzelfde lid."))) {
            return;
        }
        try {
            const patch: PatchableArrayAutoEncoder<Document> = new PatchableArray() as PatchableArrayAutoEncoder<Document>
            patch.addPut(document.clone().patch({
                id: uuidv4(),
                data: DocumentData.patch({
                    description: document.data.description + " (2)",
                }),
                status: DocumentStatus.Draft,
            }))

            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                body: patch,
                path: "/organization/documents",
                shouldRetry: false,
                owner: this.component,
                decoder: new ArrayDecoder(Document as Decoder<Document>)
            })
            const duplicatedDocument = response.data[0]
            if (duplicatedDocument) {
                this.addDocument?.(duplicatedDocument)
                this.editDocument(duplicatedDocument).catch(console.error)
                
                new Toast(`Nieuw document aangemaakt. Pas de naam en gegevens aan.`, 'success').show()
            } else {
                new Toast(`Er ging iets mis bij het dupliceren van het document`, 'error red').show()
            }
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async downloadDocument(document: Document) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/organization/documents/" + encodeURIComponent(document.id) + "/html",
                shouldRetry: false,
                timeout: 60 * 1000,
                owner: this.component,
                responseType: "text"
            })

            const html = response.data as string
            const form = new FormData()
            form.append("html", html)
            
            // Convert to PDF
            const pdfResponse = await NetworkManager.rendererServer.request({
                method: "POST",
                path: "/html-to-pdf",
                body: form as FormData,
                shouldRetry: false,
                timeout: 60 * 1000,
                owner: this.component,
                responseType: "blob"
            })

            const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
            saveAs(pdfResponse.data, Formatter.fileSlug(document.data.name + " - " + document.data.description) + ".pdf")
        } catch (e) {
            Toast.fromError(e).show()
        }
    }

    async resetDocuments(documents: Document[]) {
        if (!(await CenteredMessage.confirm(documents.length == 1 ? "Dit document resetten?" : "Weet je zeker dat je de documenten wilt resetten?", "Resetten"))) {
            return;
        }
        try {
            const arr: PatchableArrayAutoEncoder<Document> = new PatchableArray()
            for (const document of documents) {
                arr.addPatch(Document.patch(({
                    id: document.id,
                    data: DocumentData.patch({
                        fieldAnswers: [] as any
                    })
                })))
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/organization/documents",
                body: arr,
                decoder: new ArrayDecoder(Document as Decoder<Document>),
                owner: this.component
            })
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id)
                if (originalDocument) {
                    originalDocument.set(d)
                }
            }
        } catch (e) {
            Toast.fromError(e).show()
        }
    }
}