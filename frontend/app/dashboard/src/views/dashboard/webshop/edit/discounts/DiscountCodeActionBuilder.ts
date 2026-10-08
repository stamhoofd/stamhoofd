import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { RecipientChooseOneOption } from '@stamhoofd/components/email/EmailView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import { fetchAll } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { PrivateWebshop } from '@stamhoofd/structures';
import { CountFilteredRequest, DiscountCode, EmailRecipientSubfilter, LimitedFilteredRequest, mergeFilters, PrivateDiscountCode, SortItemDirection } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { generateDiscountCode } from './discountCodeGenerator';

export class DiscountCodeActionBuilder {
    navigationActions: NavigationActions;
    webshop: PrivateWebshop;
    $context: SessionContext;
    objectFetcher: ObjectFetcher<PrivateDiscountCode>;
    afterPatch: (discountCodes: PrivateDiscountCode[]) => void;

    constructor(settings: {
        navigationActions: NavigationActions;
        webshop: PrivateWebshop;
        $context: SessionContext;
        objectFetcher: ObjectFetcher<PrivateDiscountCode>;
        afterPatch: (discountCodes: PrivateDiscountCode[]) => void;
    }) {
        this.navigationActions = settings.navigationActions;
        this.webshop = settings.webshop;
        this.$context = settings.$context;
        this.objectFetcher = settings.objectFetcher;
        this.afterPatch = settings.afterPatch;
    }

    getActions(): TableAction<PrivateDiscountCode>[] {
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
                handler: async (selection: TableActionSelection<PrivateDiscountCode>) => {
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
                handler: (discountCodes: PrivateDiscountCode[]) => {
                    this.editDiscountCode(discountCodes[0]);
                },
            }),
            new MenuTableAction({
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
                        handler: (discountCodes: PrivateDiscountCode[]) => {
                            this.duplicateOnce(discountCodes[0]);
                        },
                    }),
                    new InMemoryTableAction({
                        name: $t('Meerdere keren'),
                        icon: 'copy',
                        needsSelection: true,
                        singleSelection: true,
                        handler: async (discountCodes: PrivateDiscountCode[]) => {
                            await this.duplicateMultiple(discountCodes[0]);
                        },
                    }),
                ],
            }),
            new InMemoryTableAction({
                name: $t('Kopieer instellingen naar...'),
                icon: 'sync',
                priority: 5,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (discountCodes: PrivateDiscountCode[]) => {
                    await this.copySettingsTo(discountCodes[0]);
                },
            }),
            new InMemoryTableAction({
                name: $t('Verwijderen'),
                icon: 'trash',
                destructive: true,
                priority: 1,
                groupIndex: 3,
                needsSelection: true,
                handler: async (discountCodes: PrivateDiscountCode[]) => {
                    await this.deleteDiscountCodes(discountCodes);
                },
            }),
        ];
    }

    private buildClone(discountCode: PrivateDiscountCode, code: string): PrivateDiscountCode {
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

    private async patchDiscountCodes(patch: PatchableArrayAutoEncoder<PrivateDiscountCode>) {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: 'PATCH',
                path: `/webshop/${this.webshop.id}/discount-codes`,
                body: patch,
                shouldRetry: false,
                owner: this.navigationActions,
                decoder: new ArrayDecoder(PrivateDiscountCode as Decoder<PrivateDiscountCode>),
            });
            this.afterPatch(response.data);
        } catch (e) {
            Toast.fromError(e).show();
        }
    }

    addDiscountCode() {
        const discountCode = PrivateDiscountCode.create({
            code: '',
            maximumUsage: 1,
        });
        const arr: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        arr.addPut(discountCode);

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: true,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<PrivateDiscountCode>) => {
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

    editDiscountCode(discountCode: PrivateDiscountCode) {
        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: false,
                    discountCode,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<PrivateDiscountCode>) => {
                        this.patchDiscountCodes(patch).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    duplicateOnce(discountCode: PrivateDiscountCode) {
        const cloned = this.buildClone(discountCode, '');
        const arr: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        arr.addPut(cloned);

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./EditDiscountCodeView.vue'), {
                    isNew: true,
                    discountCode: cloned,
                    webshop: this.webshop,
                    saveHandler: (patch: PatchableArrayAutoEncoder<PrivateDiscountCode>) => {
                        arr.merge(patch);
                        this.patchDiscountCodes(arr).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    async duplicateMultiple(discountCode: PrivateDiscountCode) {
        const remaining = DiscountCode.maxPerWebshop - await this.objectFetcher.fetchCount(new CountFilteredRequest({}));
        if (remaining <= 0) {
            new Toast($t('Je kan maximaal {max} kortingscodes hebben.', { max: DiscountCode.maxPerWebshop }), 'error red').show();
            return;
        }

        await this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./DuplicateDiscountCodesView.vue'), {
                    maxCount: remaining,
                    saveHandler: (count: number) => {
                        const usedCodes = new Set<string>();
                        const arr: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();

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
        });
    }

    async copySettingsTo(discountCode: PrivateDiscountCode) {
        const discountCodes = await fetchAll(new LimitedFilteredRequest({
            limit: 100,
            sort: [{ key: 'id', order: SortItemDirection.ASC }],
        }), this.objectFetcher);

        this.navigationActions.present({
            components: [
                AsyncComponent(() => import('./CopyDiscountCodeSettingsView.vue'), {
                    discountCode,
                    discountCodes,
                    saveHandler: (patch: PatchableArrayAutoEncoder<PrivateDiscountCode>) => {
                        this.patchDiscountCodes(patch).catch(console.error);
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }

    async deleteDiscountCodes(discountCodes: PrivateDiscountCode[]) {
        const title = discountCodes.length === 1
            ? (discountCodes[0].code ? $t('%Zn2', { name: discountCodes[0].code }) : $t('Deze kortingscode verwijderen?'))
            : $t('{count} kortingscodes verwijderen?', { count: discountCodes.length });
        const codes = Formatter.joinLastLimited(discountCodes.map(c => c.code), {
            separator: ', ',
            lastSeparator: ' ' + $t('%M1') + ' ',
            maxLength: 70,
            maxCount: 3,
        });

        if (!await CenteredMessage.confirm({
            title,
            confirmText: $t('%CJ'),
            description: discountCodes.length === 1
                ? $t('Je kan dit niet ongedaan maken.')
                : $t('Volgende kortingscodes worden verwijderd: {codes}. Je kan dit niet ongedaan maken.', { codes }),
            availabilityDelay: 2_000,
        })) {
            return;
        }

        const arr: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        for (const discountCode of discountCodes) {
            arr.addDelete(discountCode.id);
        }
        await this.patchDiscountCodes(arr);
    }

    async openMail(selection: TableActionSelection<PrivateDiscountCode>) {
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
