import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, CenteredMessage, EmailView, GlobalEventBus, InMemoryTableAction, RecipientChooseOneOption, RecipientMultipleChoiceOption, TableAction, TableActionSelection, Toast, useContext, useFeatureFlag, useOrganization, usePlatform } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { SessionContext } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, mergeFilters, Organization, Payment, PaymentGeneral, PaymentMethod, PaymentStatus, Platform } from '@stamhoofd/structures';
import { ComputedRef, Ref } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

type ObjectType = PaymentGeneral;

export function usePaymentActions({ configurationId, methods }: { configurationId: ComputedRef<string>; methods: PaymentMethod[] | null }) {
    const platform = usePlatform();
    const organization = useOrganization();
    const markPaid = useMarkPaymentsPaid();
    const present = usePresent();
    const selectableWorkbook = useSelectableWorkbook();
    const $feature = useFeatureFlag();
    const context = useContext();

    return new PaymentActionBuilder({
        markPaid,
        present,
        selectableWorkbook,
        configurationId,
        organization: organization.value,
        platform: platform.value,
        $feature,
        methods,
        context,
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
    private methods: PaymentMethod[] | null;
    private isSettingPaymentStatus: boolean = false;
    private context: Ref<SessionContext, SessionContext>;

    constructor(settings: {
        markPaid: ReturnType<typeof useMarkPaymentsPaid>;
        present: ReturnType<typeof usePresent>;
        selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
        configurationId: ComputedRef<string>;
        organization: Organization | null;
        platform: Platform;
        $feature: ReturnType<typeof useFeatureFlag>;
        methods: PaymentMethod[] | null;
        context: Ref<SessionContext, SessionContext>;
    }) {
        this.markPaid = settings.markPaid;
        this.present = settings.present;
        this.selectableWorkbook = settings.selectableWorkbook;
        this.configurationId = settings.configurationId;
        this.organization = settings.organization;
        this.platform = settings.platform;
        this.$feature = settings.$feature;
        this.methods = settings.methods;
        this.context = settings.context;
    }

    getActions(): TableAction<ObjectType>[] {
        const actions: (TableAction<ObjectType> | null)[] = [
            new InMemoryTableAction({
                name: $t('03bd6cff-83c4-44ec-8b0d-7826bf5b4166'),
                icon: 'success',
                priority: 3,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, true);
                },
            }),
            new InMemoryTableAction({
                name: $t('b3d75fdd-8231-4a1f-a1b3-5c6401d90a75'),
                icon: 'canceled',
                priority: 2,
                groupIndex: 1,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    // Mark paid
                    await this.markPaid(payments, false);
                },
            }),
            this.getCancelPaymentsAction(),
            new AsyncTableAction({
                name: $t('60c06238-ad4d-4599-a3d3-ebe856476618'),
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

        ];

        if (this.$feature('email-to-payments')) {
            actions.push(this.getEmailAction());
        }

        return actions.filter(action => action !== null);
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

    private getCancelPaymentsAction(): TableAction<ObjectType> | null {
        // only for methods transfer and point of sale, not if any other method
        if (this.methods && this.methods.every(method => method === PaymentMethod.Transfer || method === PaymentMethod.PointOfSale)) {
            return new InMemoryTableAction({
                name: $t('11d2e292-fd08-4477-bd2a-dac599a9754c'),
                icon: 'canceled',
                priority: 1,
                groupIndex: 4,
                enabled: !this.isSettingPaymentStatus,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (payments: PaymentGeneral[]) => {
                    const filteredPayments = payments.filter(payment => (payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created) && (payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.PointOfSale));
                    if (filteredPayments.length === 0) {
                        Toast.error($t('523385f0-a103-454b-909c-6a6e1b70972e')).show();
                        return;
                    }

                    const text = filteredPayments.length === 1 ? $t('99810042-aa71-49a4-9cb4-c4fb23b7bc62') : $t('658662ba-ba2c-4e4c-8da7-7d73be8d7490', { count: payments.length });
                    if (!await CenteredMessage.confirm(text, $t('cdf0fafe-b364-4dbb-ae31-b593cf447298'), $t('4d83cf39-66a5-4759-a95a-3245cd17d8b3'))) {
                        return;
                    }

                    await this.setPaymentStatus(PaymentStatus.Failed, filteredPayments);
                },
            });
        }
        return null;
    }

    private async setPaymentStatus(status: PaymentStatus, payments: PaymentGeneral[]) {
        if (this.isSettingPaymentStatus || payments.length === 0) {
            return;
        }

        this.isSettingPaymentStatus = true;

        try {
            const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();

            for (const payment of payments) {
                data.addPatch(Payment.patch({
                    id: payment.id,
                    status,
                }));
            }

            const response = await this.context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body: data,
                decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                shouldRetry: false,
            });

            for (const paymentResponse of response.data) {
                const originalPayment = payments.find(p => p.id === paymentResponse.id);
                if (originalPayment) {
                    originalPayment.deepSet(paymentResponse);
                }

                GlobalEventBus.sendEvent('paymentPatch', paymentResponse).catch(console.error);
            }

            const message = payments.length === 1 ? $t('8076e99d-cac2-4fb6-84e0-d893d9b3c205') : $t('7fcd4a8a-e9ab-443b-b887-383c6802c644', { count: payments.length });
            Toast.success(message).setHide(1000).show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        this.isSettingPaymentStatus = false;
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
                        name: $t(`2e0554e5-f223-4618-942e-53ec88f26e19`),
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
                name: $t('58575442-6c76-4454-b33c-2b83f23c5269'),
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
                        name: $t(`fad703f0-baef-4172-bea3-071711d8df6f`),
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
                        name: $t(`1324e6e2-0703-49e1-8031-0a657787066d`),
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
