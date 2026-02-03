import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, EmailView, InMemoryTableAction, RecipientChooseOneOption, RecipientMultipleChoiceOption, TableAction, TableActionSelection, useFeatureFlag, useOrganization, usePlatform } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, mergeFilters, Organization, PaymentGeneral, Platform } from '@stamhoofd/structures';
import { ComputedRef } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

type ObjectType = PaymentGeneral;

export function usePaymentActions({ configurationId }: { configurationId: ComputedRef<string> }) {
    const platform = usePlatform();
    const organization = useOrganization();
    const markPaid = useMarkPaymentsPaid();
    const present = usePresent();
    const selectableWorkbook = useSelectableWorkbook();
    const $feature = useFeatureFlag();

    return new PaymentActionBuilder({
        markPaid,
        present,
        selectableWorkbook,
        configurationId,
        organization: organization.value,
        platform: platform.value,
        $feature,
    });
}

export class PaymentActionBuilder {
    private present: ReturnType<typeof usePresent>;
    private markPaid: ReturnType<typeof useMarkPaymentsPaid>;
    private selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
    private configurationId: ComputedRef<string>;
    private organization: Organization | null;
    private platform: Platform;
    private $feature: ReturnType<typeof useFeatureFlag>;

    constructor(settings: {
        markPaid: ReturnType<typeof useMarkPaymentsPaid>;
        present: ReturnType<typeof usePresent>;
        selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
        configurationId: ComputedRef<string>;
        organization: Organization | null;
        platform: Platform;
        $feature: ReturnType<typeof useFeatureFlag>;
    }) {
        this.markPaid = settings.markPaid;
        this.present = settings.present;
        this.selectableWorkbook = settings.selectableWorkbook;
        this.configurationId = settings.configurationId;
        this.organization = settings.organization;
        this.platform = settings.platform;
        this.$feature = settings.$feature;
    }

    getActions() {
        const actions: TableAction<ObjectType>[] = [
            new InMemoryTableAction({
                name: $t('03bd6cff-83c4-44ec-8b0d-7826bf5b4166'),
                icon: 'success',
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, true);
                },
            }),
            new InMemoryTableAction({
                name: $t('fb1d3820-b4d3-446b-ab4b-931b16eb5391'),
                icon: 'canceled',
                priority: 1,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, false);
                },
            }),

            new AsyncTableAction({
                name: $t('f97a138d-13eb-4e33-aee3-489d9787b2c8'),
                icon: 'download',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: true,
                handler: async (selection) => {
                    await this.present({
                        components: [
                            new ComponentWithProperties(NavigationController, {
                                root: new ComponentWithProperties(ExcelExportView, {
                                    type: ExcelExportType.Payments,
                                    filter: selection.filter,
                                    workbook: this.selectableWorkbook.getSelectableWorkbook(),
                                    configurationId: this.configurationId.value,
                                }),
                            }),
                        ],
                        modalDisplayStyle: 'popup',
                    });
                },
            }),
            this.getEmailAction(),
        ];

        return actions;
    }

    private getEmailAction() {
        return new AsyncTableAction({
            name: $t(`208ae3f1-1720-4d79-96fd-5c05d97c9de0`),
            icon: 'email',
            priority: 12,
            groupIndex: 3,
            handler: async (selection: TableActionSelection<ObjectType>) => {
                await this.openMail(selection);
            },
        });
    }

    private async openMail(selection: TableActionSelection<ObjectType>) {
        const filter = selection.filter.filter;
        const search = selection.filter.search;

        const options: (RecipientChooseOneOption | RecipientMultipleChoiceOption)[] = [];

        const canPaymentsBetweenOrganizationsExist = this.$feature('organization-receivable-balances');

        if (!canPaymentsBetweenOrganizationsExist) {
            options.push({
                type: 'ChooseOne',
                options: [
                    {
                        id: 'all',
                        name: $t(`Alle betalingen`),
                        value: [
                            EmailRecipientSubfilter.create({
                                type: EmailRecipientFilterType.Payment,
                                filter,
                                search,
                            }),
                        ],
                    },
                ],
            });
        }
        else {
            const organizationOption: RecipientMultipleChoiceOption = {
                type: 'MultipleChoice',
                name: $t('Betalingen van verenigingen'),
                options: [],
                defaultSelection: this.organization?.privateMeta?.balanceNotificationSettings.getOrganizationContactsFilterResponsibilityIds() ?? [],
                build: (selectedIds: string[]) => {
                    if (selectedIds.length === 0) {
                        return [];
                    }

                    const q = EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.PaymentOrganization,
                        filter: mergeFilters([filter, {
                            $or: [
                                {
                                    payingOrganizationId: {
                                        $neq: null,
                                    },
                                }, {
                                    balanceItemPayments: {
                                        $elemMatch: {
                                            balanceItem: {
                                                payingOrganizationId: {
                                                    $neq: null,
                                                },
                                            },

                                        },
                                    },
                                },
                            ],
                        }]),
                        search,
                        subfilter: {
                            responsibilityId: {
                                $in: selectedIds,
                            },
                        },
                    });

                    return [
                        q,
                    ];
                },
            };

            for (const responsibility of this.platform.config.responsibilities) {
                if (!responsibility.organizationBased) {
                    continue;
                }
                organizationOption.options.push(
                    {
                        id: responsibility.id,
                        name: responsibility.name,
                    },
                );
            }

            const otherPayments: RecipientChooseOneOption = {
                type: 'ChooseOne',
                options: [
                    {
                        id: 'all',
                        name: $t(`Alle andere betalingen`),
                        value: [
                            EmailRecipientSubfilter.create({
                                type: EmailRecipientFilterType.Payment,
                                filter: mergeFilters([filter, {
                                    $and: [
                                        {
                                            payingOrganizationId: {
                                                $eq: null,
                                            },
                                        }, {
                                            balanceItemPayments: {
                                                $elemMatch: {
                                                    balanceItem: {
                                                        payingOrganizationId: {
                                                            $eq: null,
                                                        },
                                                    },

                                                },
                                            },
                                        },
                                    ],
                                }]),
                                search,
                            }),
                        ],
                    },
                    {
                        id: 'none',
                        name: $t(`Geen andere betalingen`),
                        value: [],
                    },
                ],
            };

            options.push(organizationOption, otherPayments);
        }

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                recipientFilterOptions: options,
            }),
        });
        await this.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }
}
