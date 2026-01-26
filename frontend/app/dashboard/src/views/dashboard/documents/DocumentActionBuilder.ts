import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, CenteredMessage, EmailView, InMemoryTableAction, LoadComponent, NavigationActions, RecipientChooseOneOption, TableAction, TableActionSelection, Toast } from '@stamhoofd/components';
import { downloadDocuments } from '@stamhoofd/document-helper';
import { SessionContext } from '@stamhoofd/networking';
import { DocumentData, DocumentStatus, Document as DocumentStruct, DocumentTemplatePrivate, EmailRecipientFilterType, EmailRecipientSubfilter } from '@stamhoofd/structures';
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
                name: $t(`7c4a4aa1-de17-466c-94a1-1fdff3fa4fc5`),
                icon: 'download',
                priority: 5,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: true,
                handler: (documents: DocumentStruct[]) => {
                    this.downloadDocuments(documents).catch(console.error);
                },
            }),

            new AsyncTableAction({
                name: $t(`208ae3f1-1720-4d79-96fd-5c05d97c9de0`),
                icon: 'email',
                priority: 6,
                groupIndex: 2,
                handler: async (selection: TableActionSelection<DocumentStruct>) => {
                    await this.openMail(selection);
                },
            }),

            new InMemoryTableAction({
                name: $t(`ab817255-45d5-4eb8-970c-ea927730532b`),
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
                name: $t(`1c8e7100-b4ac-4c22-8e22-a19d3c039f74`),
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
                name: $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`),
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
                name: $t(`574829bb-6ffc-489b-bc83-f3439dc62ffa`),
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

    async openMail(selection: TableActionSelection<DocumentStruct>) {
        const filter = selection.filter.filter;
        const search = selection.filter.search;

        const options: RecipientChooseOneOption[] = [];

        options.push({
            type: 'ChooseOne',
            name: $t('672a6035-da6d-403b-a31e-242cdd92cc5b'),
            options: [
                {
                    id: 'accounts',
                    name: $t(`379d43fb-034f-4280-bb99-ea658eaec729`),
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.Documents,
                            filter,
                            search,
                        }),
                    ],
                },
            ],
        });

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                recipientFilterOptions: options,
                defaultSenderId: null,
            }),
        });
        await this.navigationActions.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }

    async editDocument(document: DocumentStruct) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditDocumentView" */ './EditDocumentView.vue'), {
            document,
            template: this.template,
            isNew: false,
        });
        this.navigationActions.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async deleteDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? $t('d95060d8-ba97-4955-8731-142fe5322055', { count: documents.length.toString() }) : $t(`9ec68c0f-9a7c-4ad2-adae-201148284060`), $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`)))) {
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
            new Toast(documents.length === 1 ? $t(`5ba065ed-884a-4bea-aa3b-839550938146`) : $t('a1f37704-1f81-44cd-94ce-9b26ffc8e3dd', { count: documents.length.toString() }), 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async undoDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? $t('27979c56-6bea-4832-ad5d-4f3b0ca699db', { count: documents.length.toString() }) : $t(`c10b9adb-b872-4960-8141-bb28abdf2312`), $t(`574829bb-6ffc-489b-bc83-f3439dc62ffa`)))) {
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
            new Toast(documents.length === 1 ? $t(`8c4639d3-2c92-46a7-9964-d991731f8846`) : $t('7a1ba709-2353-4106-9207-9205edac9c37', { count: documents.length.toString() }), 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async duplicateDocument(document: DocumentStruct) {
        if (!(await CenteredMessage.confirm($t(`9b55fc64-a8c9-4d8d-a476-13a33b8d1fb0`), $t(`1c8e7100-b4ac-4c22-8e22-a19d3c039f74`), $t(`f7459630-8638-43ff-888d-2fcf6995dced`)))) {
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

                new Toast($t('e76ab11c-5160-47a1-baa9-a20f44d47877'), 'success').show();
            }
            else {
                new Toast($t('609e9ee3-cd02-4055-9f06-11cf75e43c7e'), 'error red').show();
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
            new Toast(`${invalidDocuments.length} ${invalidDocuments.length === 1 ? $t(`acaf4b80-5061-4875-9365-d729f3ea0afb`) : $t(`dd7d331c-73ff-4c6a-946d-e4dd2116efe9`)}`, invalidDocuments.length === documents.length ? 'error red' : 'warning yellow').show();
        }
        const validDocuments = documents.filter(d => d.status !== DocumentStatus.MissingData);
        if (validDocuments.length) {
            await downloadDocuments(this.$context, validDocuments, this.navigationActions);
        }
    }

    async resetDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length == 1 ? $t(`db59de67-3f9f-4a02-bf65-556bdd2bf817`) : $t(`0370632e-e36d-4bc2-87c7-4d785f709d74`), $t(`56813a5d-8e74-4487-8fa9-d2d9d72bfd3d`)))) {
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
