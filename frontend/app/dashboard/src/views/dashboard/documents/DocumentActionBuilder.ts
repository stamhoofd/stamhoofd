import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import EmailView, { type RecipientChooseOneOption } from '@stamhoofd/components/email/EmailView.vue';
import { LoadComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { downloadDocuments } from '@stamhoofd/document-helper';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { DocumentTemplatePrivate} from '@stamhoofd/structures';
import { DocumentData, DocumentStatus, Document as DocumentStruct, EmailRecipientFilterType, EmailRecipientSubfilter } from '@stamhoofd/structures';
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
                name: $t(`%1B7`),
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
                name: $t(`%1GW`),
                icon: 'email',
                priority: 6,
                groupIndex: 2,
                handler: async (selection: TableActionSelection<DocumentStruct>) => {
                    await this.openMail(selection);
                },
            }),

            new InMemoryTableAction({
                name: $t(`%1Bm`),
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
                name: $t(`%KK`),
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
                name: $t(`%CJ`),
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
                name: $t(`%KL`),
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
            name: $t('%1EH'),
            options: [
                {
                    id: 'accounts',
                    name: $t(`%L8`),
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
        if (!(await CenteredMessage.confirm(documents.length > 1 ? $t('%KE', { count: documents.length.toString() }) : $t(`%KM`), $t(`%CJ`)))) {
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
            new Toast(documents.length === 1 ? $t(`%KN`) : $t('%KF', { count: documents.length.toString() }), 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async undoDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length > 1 ? $t('%KG', { count: documents.length.toString() }) : $t(`%KO`), $t(`%KL`)))) {
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
            new Toast(documents.length === 1 ? $t(`%KP`) : $t('%KH', { count: documents.length.toString() }), 'success').show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async duplicateDocument(document: DocumentStruct) {
        if (!(await CenteredMessage.confirm($t(`%KQ`), $t(`%KK`), $t(`%KR`)))) {
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

                new Toast($t('%KI'), 'success').show();
            }
            else {
                new Toast($t('%KJ'), 'error red').show();
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
            new Toast(`${invalidDocuments.length} ${invalidDocuments.length === 1 ? $t(`%KS`) : $t(`%KT`)}`, invalidDocuments.length === documents.length ? 'error red' : 'warning yellow').show();
        }
        const validDocuments = documents.filter(d => d.status !== DocumentStatus.MissingData);
        if (validDocuments.length) {
            await downloadDocuments(this.$context, validDocuments, this.navigationActions);
        }
    }

    async resetDocuments(documents: DocumentStruct[]) {
        if (!(await CenteredMessage.confirm(documents.length == 1 ? $t(`%KU`) : $t(`%KV`), $t(`%KW`)))) {
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
