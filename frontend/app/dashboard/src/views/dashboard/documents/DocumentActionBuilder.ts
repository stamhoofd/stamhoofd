import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, InMemoryTableAction, LoadComponent, NavigationActions, TableAction, Toast } from '@stamhoofd/components';
import { downloadDocuments } from '@stamhoofd/document-helper';
import { SessionContext } from '@stamhoofd/networking';
import { DocumentData, DocumentStatus, Document as DocumentStruct, DocumentTemplatePrivate } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class DocumentActionBuilder {
    navigationActions: NavigationActions;
    template: DocumentTemplatePrivate;
    addDocument?: (document: DocumentStruct) => void;
    $context: SessionContext;

    constructor(settings: {
        navigationActions: NavigationActions;
        template: DocumentTemplatePrivate;
        addDocument?: (document: DocumentStruct) => void;
        $context: SessionContext;
    }) {
        this.navigationActions = settings.navigationActions;
        this.template = settings.template;
        this.addDocument = settings.addDocument;
        this.$context = settings.$context;
    }

    getActions(): TableAction<DocumentStruct>[] {
        return [
            new InMemoryTableAction({
                name: 'Downloaden',
                icon: 'download',
                priority: 5,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: true,
                handler: (documents: DocumentStruct[]) => {
                    this.downloadDocuments(documents).catch(console.error);
                },
            }),

            new InMemoryTableAction({
                name: 'Wijzig',
                icon: 'edit',
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: async (documents: DocumentStruct[]) => {
                    await this.editDocument(documents[0]);
                },
            }),

            new InMemoryTableAction({
                name: 'Dupliceren',
                icon: 'copy',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                allowAutoSelectAll: false,
                handler: async (documents: DocumentStruct[]) => {
                    await this.duplicateDocument(documents[0]);
                },
            }),

            new InMemoryTableAction({
                name: 'Verwijderen',
                icon: 'trash',
                priority: 1,
                groupIndex: 3,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (documents: DocumentStruct[]) => {
                    await this.deleteDocuments(documents);
                },
            }),

            new InMemoryTableAction({
                name: 'Terugzetten',
                icon: 'undo',
                priority: 1,
                groupIndex: 3,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (documents: DocumentStruct[]) => {
                    await this.undoDocuments(documents);
                },
            }),
        ];
    }

    async editDocument(document: DocumentStruct) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditDocumentView" */ './EditDocumentView.vue'), {
            document,
            template: this.template,
            isNew: false
        });
        this.navigationActions.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async deleteDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? `${documents.length} documenten verwijderen?` : 'Dit document verwijderen?', 'Verwijderen'))) {
            return;
        }
        try {
            const patch: PatchableArrayAutoEncoder<DocumentStruct> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentStruct>;
            for (const document of documents) {
                patch.addPatch(DocumentStruct.patch({
                    id: document.id,
                    status: DocumentStatus.Deleted,
                }));
            }
            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                body: patch,
                path: '/organization/documents',
                shouldRetry: false,
                owner: this.navigationActions,
                decoder: new ArrayDecoder(DocumentStruct as Decoder<DocumentStruct>),
            });
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id);
                if (originalDocument) {
                    originalDocument.deepSet(d);
                }
            }
            new Toast(documents.length === 1 ? 'Document verwijderd' : `${documents.length} documenten verwijderd`, 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async undoDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? `${documents.length} documenten uit prullenmand terug halen?` : 'Dit document uit prullenmand terug halen?', 'Terugzetten'))) {
            return;
        }
        try {
            const patch: PatchableArrayAutoEncoder<DocumentStruct> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentStruct>;
            for (const document of documents) {
                patch.addPatch(DocumentStruct.patch({
                    id: document.id,
                    status: DocumentStatus.Draft,
                }));
            }
            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                body: patch,
                path: '/organization/documents',
                shouldRetry: false,
                owner: this.navigationActions,
                decoder: new ArrayDecoder(DocumentStruct as Decoder<DocumentStruct>),
            });
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id);
                if (originalDocument) {
                    originalDocument.deepSet(d);
                }
            }
            new Toast(documents.length === 1 ? 'Document teruggezet' : `${documents.length} documenten teruggezet`, 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async duplicateDocument(document: DocumentStruct) {
        if (!(await CenteredMessage.confirm('Dit document dupliceren?', 'Dupliceren', 'Gebruik dit als je hetzelfde attest in verschillende versies wilt beschikbaar maken aan hetzelfde lid.'))) {
            return;
        }
        try {
            const patch: PatchableArrayAutoEncoder<DocumentStruct> = new PatchableArray() as PatchableArrayAutoEncoder<DocumentStruct>;
            patch.addPut(document.clone().patch({
                id: uuidv4(),
                data: DocumentData.patch({
                    description: document.data.description + ' (2)',
                }),
                status: DocumentStatus.Draft,
            }));

            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                body: patch,
                path: '/organization/documents',
                shouldRetry: false,
                owner: this.navigationActions,
                decoder: new ArrayDecoder(DocumentStruct as Decoder<DocumentStruct>),
            });
            const duplicatedDocument = response.data[0];
            if (duplicatedDocument) {
                this.addDocument?.(duplicatedDocument);
                this.editDocument(duplicatedDocument).catch(console.error);

                new Toast(`Nieuw document aangemaakt. Pas de naam en gegevens aan.`, 'success').show();
            }
            else {
                new Toast(`Er ging iets mis bij het dupliceren van het document`, 'error red').show();
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async downloadDocuments(documents: DocumentStruct[]) {
        // Filter invalid documents
        const invalidDocuments = documents.filter(d => d.status === DocumentStatus.MissingData);
        if (invalidDocuments.length > 0) {
            new Toast(`${invalidDocuments.length} ${invalidDocuments.length === 1 ? 'onvolledig document kan niet gedownload worden' : 'onvolledige documenten kunnen niet gedownload worden'}`, invalidDocuments.length === documents.length ? 'error red' : 'warning yellow').show();
        }
        const validDocuments = documents.filter(d => d.status !== DocumentStatus.MissingData);
        if (validDocuments.length) {
            await downloadDocuments(this.$context, validDocuments, this.navigationActions);
        }
    }

    async resetDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length == 1 ? 'Dit document resetten?' : 'Weet je zeker dat je de documenten wilt resetten?', 'Resetten'))) {
            return;
        }
        try {
            const arr: PatchableArrayAutoEncoder<DocumentStruct> = new PatchableArray();
            for (const document of documents) {
                arr.addPatch(DocumentStruct.patch(({
                    id: document.id,
                    data: DocumentData.patch({
                        fieldAnswers: [] as any,
                    }),
                })));
            }

            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/documents',
                body: arr,
                decoder: new ArrayDecoder(DocumentStruct as Decoder<DocumentStruct>),
                owner: this.navigationActions,
            });
            for (const d of response.data) {
                const originalDocument = documents.find(d2 => d2.id == d.id);
                if (originalDocument) {
                    originalDocument.deepSet(d);
                }
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }
}
