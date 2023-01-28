import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"
import { Request } from "@simonbackx/simple-networking"
import { CenteredMessage, LoadComponent, TableAction, Toast } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking"
import { Document, DocumentData, DocumentTemplatePrivate } from "@stamhoofd/structures"

export class DocumentActionBuilder {
    component: any
    template: DocumentTemplatePrivate

    constructor(settings: {
        component: any,
        template: DocumentTemplatePrivate
    }) {
        this.component = settings.component
        this.template = settings.template
    }

    getActions() {
        return [
            new TableAction({
                name: "Downloaden",
                icon: "download",
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (documents: Document[]) => {
                    await this.downloadDocument(documents[0])
                }
            }),

            new TableAction({
                name: "Document toevoegen",
                icon: "add",
                priority: 1,
                groupIndex: 2,
                needsSelection: false,
                handler: async () => {
                    //await this.createOrder()
                }
            }),

            new TableAction({
                name: "Wijzig...",
                icon: "edit",
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (documents: Document[]) => {
                    await this.editDocument(documents[0])
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

    async downloadDocument(document: Document) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/organization/documents/" + encodeURIComponent(document.id) + "/download",
                shouldRetry: false,
                timeout: 60 * 1000,
                owner: this,
                responseType: "blob"
            } as any)
            console.log(response);
            const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
            saveAs(response.data, document.id + ".pdf")
        } catch (e) {
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show()
            }
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
                decoder: new ArrayDecoder(Document as Decoder<Document>)
            })
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id)
                if (originalDocument) {
                    originalDocument.set(d)
                }
            }
        } catch (e) {
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show()
            }
        }
    }
}