import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { RecipientChooseOneOption } from '@stamhoofd/components/email/EmailView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { PrivateWebshop } from '@stamhoofd/structures';
import { DiscountCode, EmailRecipientFilterType, EmailRecipientSubfilter, LimitedFilteredRequest, mergeFilters, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { generateDiscountCode } from './discountCodeGenerator';

export class DiscountCodeActionBuilder {
    navigationActions: NavigationActions;
    webshop: PrivateWebshop;
    $context: SessionContext;
    afterPatch: (discountCodes: DiscountCode[]) => void;

    constructor(settings: {
        navigationActions: NavigationActions;
        webshop: PrivateWebshop;
        $context: SessionContext;
        afterPatch: (discountCodes: DiscountCode[]) => void;
    }) {
        this.navigationActions = settings.navigationActions;
        this.webshop = settings.webshop;
        this.$context = settings.$context;
        this.afterPatch = settings.afterPatch;
    }

    getActions(): TableAction<DiscountCode>[] {
        return [
            new InMemoryTableAction({
                name: $t('Nieuw'),
                icon: 'add',
                priority: 10,
                groupIndex: 1,
                needsSelection: false,
                handler: () => {
                    this.addDiscountCode();
                },
            }),
            new InMemoryTableAction({
                name: $t('Importeren'),
                icon: 'upload',
                priority: 9,
                groupIndex: 1,
                needsSelection: false,
                handler: () => {
                    this.importDiscountCodes();
                },
            }),
            new AsyncTableAction({
                name: $t('E-mail versturen'),
                icon: 'email',
                priority: 8,
                groupIndex: 1,
                handler: async (selection: TableActionSelection<DiscountCode>) => {
                    await this.openMail(selection);
                },
            }),
            new InMemoryTableAction({
                name: $t('Bewerken'),
                icon: 'edit',
                priority: 7,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (discountCodes: DiscountCode[]) => {
                    this.editDiscountCode(discountCodes[0]);
                },
            }),
            new InMemoryTableAction({
                name: $t('Dupliceren'),
                icon: 'copy',
                priority: 6,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                childActions: [
                    new InMemoryTableAction({
                        name: $t('Eén keer'),
                        icon: 'copy',
                        needsSelection: true,
                        singleSelection: true,
                        handler: (discountCodes: DiscountCode[]) => {
                            this.duplicateOnce(discountCodes[0]);
                        },
                    }),
                    new InMemoryTableAction({
                        name: $t('Meerdere keren'),
                        icon: 'copy',
                        needsSelection: true,
                        singleSelection: true,
                        handler: (discountCodes: DiscountCode[]) => {
                            this.duplicateMultiple(discountCodes[0]);
                        },
                    }),
                ],
                handler: () => {
                    // Child actions handle the work.
                },
            }),
            new InMemoryTableAction({
                name: $t('Kopieer instellingen naar...'),
                icon: 'sync',
                priority: 5,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: (discountCodes: DiscountCode[]) => {
                    this.copySettingsTo(discountCodes[0]).catch(console.error);
                },
            }),
            new InMemoryTableAction({
                name: $t('Verwijderen'),
                icon: 'trash',
                destructive: true,
                priority: 1,
                groupIndex: 3,
                needsSelection: true,
                handler: async (discountCodes: DiscountCode[]) => {
                    await this.deleteDiscountCodes(discountCodes);
                },
            }),
        ];
    }

    private buildClone(discountCode: DiscountCode, code: string): DiscountCode {
        const cloned = discountCode.clone();
        cloned.id = uuidv4();
        cloned.code = code;
        cloned.email = null;
        cloned.usageCount = 0;
        cloned.reserved = false;
        cloned.createdAt = new Date();
        cloned.updatedAt = new Date();
        return cloned;
    }

    private async patchDiscountCodes(patch: PatchableArrayAutoEncoder<DiscountCode>) {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                path: `/webshop/${this.webshop.id}/discount-codes`,
                body: patch,
                shouldRetry: false,
                owner: this.navigationActions,
                decoder: new ArrayDecoder(DiscountCode as Decoder<DiscountCode>),
            });
            this.afterPatch(response.data);
        } catch (e) {
            Toast.fromError(e).show();
        }
    }

    addDiscountCode() {
        const discountCode = DiscountCode.create({
            code: '',
            maximumUsage: 1,
        });
        const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
        arr.addPut(discountCode);

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: true,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        arr.merge(patch);
                        this.patchDiscountCodes(arr).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    importDiscountCodes() {
        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./ImportDiscountCodesView.vue'), {
                    webshop: this.webshop,
                    afterImport: this.afterPatch,
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    editDiscountCode(discountCode: DiscountCode) {
        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: false,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        this.patchDiscountCodes(patch).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    duplicateOnce(discountCode: DiscountCode) {
        const cloned = this.buildClone(discountCode, '');
        const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
        arr.addPut(cloned);

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: true,
                    discountCode: cloned,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        arr.merge(patch);
                        this.patchDiscountCodes(arr).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    duplicateMultiple(discountCode: DiscountCode) {
        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./DuplicateDiscountCodesView.vue'), {
                    maxCount: 1000,
                    saveHandler: (count: number) => {
                        const usedCodes = new Set<string>();
                        const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();

                        for (let i = 0; i < count; i++) {
                            let code = generateDiscountCode();
                            while (usedCodes.has(code)) {
                                code = generateDiscountCode();
                            }
                            usedCodes.add(code);
                            arr.addPut(this.buildClone(discountCode, code));
                        }

                        this.patchDiscountCodes(arr).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'sheet',
        }).catch(console.error);
    }

    async copySettingsTo(discountCode: DiscountCode) {
        const response = await this.$context.authenticatedServer.request({
            method: 'GET',
            path: `/webshop/${this.webshop.id}/discount-codes`,
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(DiscountCode as Decoder<DiscountCode>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: new LimitedFilteredRequest({
                limit: 1000,
                sort: [{ key: 'id', order: SortItemDirection.ASC }],
            }),
            shouldRetry: false,
            owner: this.navigationActions,
            timeout: 30 * 1000,
        });

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./CopyDiscountCodeSettingsView.vue'), {
                    discountCode,
                    discountCodes: response.data.results,
                    saveHandler: (patch: PatchableArrayAutoEncoder<DiscountCode>) => {
                        this.patchDiscountCodes(patch).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    async deleteDiscountCodes(discountCodes: DiscountCode[]) {
        if (!await CenteredMessage.confirm(discountCodes.length === 1 ? $t('Ben je zeker dat je deze kortingscode wilt verwijderen?') : $t('Ben je zeker dat je deze kortingscodes wilt verwijderen?'), $t('Verwijderen'))) {
            return;
        }

        const arr: PatchableArrayAutoEncoder<DiscountCode> = new PatchableArray();
        for (const discountCode of discountCodes) {
            arr.addDelete(discountCode.id);
        }
        await this.patchDiscountCodes(arr);
    }

    async openMail(selection: TableActionSelection<DiscountCode>) {
        if (this.webshop.isClosed()) {
            new Toast($t('Open de webshop om e-mails met kortingscodes te versturen.'), 'error red').show();
            return;
        }

        const options: RecipientChooseOneOption[] = [
            {
                type: 'ChooseOne',
                options: [
                    {
                        id: 'discount-codes',
                        name: $t('Kortingscodes'),
                        value: [
                            EmailRecipientSubfilter.create({
                                type: EmailRecipientFilterType.WebshopDiscountCodes,
                                filter: mergeFilters([selection.filter.filter, {
                                    webshopId: this.webshop.id,
                                }]),
                                search: selection.filter.search,
                            }),
                        ],
                    },
                ],
            },
        ];

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('@stamhoofd/components/email/EmailView.vue'), {
                recipientFilterOptions: options,
                defaultSenderId: this.webshop.privateMeta.defaultEmailId,
            }),
        });
        await this.navigationActions.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }
}
