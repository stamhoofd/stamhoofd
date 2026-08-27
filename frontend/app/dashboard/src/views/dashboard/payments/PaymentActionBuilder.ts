import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { RecipientChooseOneOption, RecipientMultipleChoiceOption } from '@stamhoofd/components/email/EmailView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Organization, Platform } from '@stamhoofd/structures';
import { EmailRecipientSubfilter, ExcelExportType, mergeFilters, Payment, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import type { ComputedRef, Ref } from 'vue';
import { useBreakdown } from '../breakdown/openBreakdown';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

type ObjectType = PaymentGeneral;

export function usePaymentActions({ configurationId, methods, reload }: { configurationId: ComputedRef<string>; methods: PaymentMethod[] | null; reload?: (() => Promise<void> | void) | null }) {
    const platform = usePlatform();
    const organization = useOrganization();
    const markPaid = useMarkPaymentsPaid();
    const present = usePresent();
    const selectableWorkbook = useSelectableWorkbook();
    const $feature = useFeatureFlag();
    const context = useContext();
    const { openPayments } = useBreakdown();

    return new PaymentActionBuilder({
        markPaid,
        present,
        openPaymentBreakdown: openPayments,
        selectableWorkbook,
        configurationId,
        organization: organization.value,
        platform: platform.value,
        $feature,
        methods,
        context,
        reload: reload ?? null,
    });
}

export class PaymentActionBuilder {
    private present: ReturnType<typeof usePresent>;
    private markPaid: ReturnType<typeof useMarkPaymentsPaid>;
    private selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
    private openPaymentBreakdown: ReturnType<typeof useBreakdown>['openPayments'];
    private configurationId: ComputedRef<string>;
    private organization: Organization | null;
    private platform: Platform;
    private $feature: ReturnType<typeof useFeatureFlag>;
    private methods: PaymentMethod[] | null;
    private isSettingPaymentStatus: boolean = false;
    private context: Ref<SessionContext, SessionContext>;
    private reload: (() => Promise<void> | void) | null;

    constructor(settings: {
        markPaid: ReturnType<typeof useMarkPaymentsPaid>;
        present: ReturnType<typeof usePresent>;
        openPaymentBreakdown: ReturnType<typeof useBreakdown>['openPayments'];
        selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
        configurationId: ComputedRef<string>;
        organization: Organization | null;
        platform: Platform;
        $feature: ReturnType<typeof useFeatureFlag>;
        methods: PaymentMethod[] | null;
        context: Ref<SessionContext, SessionContext>;
        reload?: (() => Promise<void> | void) | null;
    }) {
        this.markPaid = settings.markPaid;
        this.present = settings.present;
        this.openPaymentBreakdown = settings.openPaymentBreakdown;
        this.selectableWorkbook = settings.selectableWorkbook;
        this.configurationId = settings.configurationId;
        this.organization = settings.organization;
        this.platform = settings.platform;
        this.$feature = settings.$feature;
        this.methods = settings.methods;
        this.context = settings.context;
        this.reload = settings.reload ?? null;
    }

    getActions(): TableAction<ObjectType>[] {
        const actions: (TableAction<ObjectType> | null)[] = [
            new InMemoryTableAction({
                name: $t('%1JQ'),
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
                name: $t('%MZ'),
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
            this.getRefundPaymentsAction(),
            new AsyncTableAction({
                name: $t('%Pa'),
                icon: 'stats',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: true,
                handler: async (selection) => {
                    await this.openPaymentBreakdown({
                        filter: selection.filter.filter,
                        search: selection.filter.search,
                        title: this.getSelectionName(),
                        rootTitle: this.getExcelTitle(),
                        getSelectableWorkbook: this.selectableWorkbook.getSelectableWorkbook,
                        configurationId: this.configurationId.value,
                        present: true,
                    });
                },
            }),
            new AsyncTableAction({
                name: $t('%V8'),
                icon: 'download',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: true,
                handler: async (selection) => {
                    await this.present({
                        components: [
                            new ComponentWithProperties(NavigationController, {
                                root: AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                                    type: ExcelExportType.Payments,
                                    filter: selection.filter,
                                    workbook: this.selectableWorkbook.getSelectableWorkbook(),
                                    configurationId: this.configurationId.value,
                                    title: this.getExcelTitle(),
                                }),
                            }),
                        ],
                        modalDisplayStyle: 'popup',
                    });
                },
            }),

        ];

        actions.push(this.getEmailAction());

        return actions.filter(action => action !== null);
    }

    /**
     * What this list of payments is called, e.g. 'Overschrijvingen'.
     */
    private getSelectionName() {
        return this.methods?.length === 1 ? PaymentMethodHelper.getPluralNameCapitalized(this.methods[0]) : $t('%1JH');
    }

    private getExcelTitle() {
        const parts = [
            this.organization && this.context.value.auth.hasSomePlatformAccess() ? this.organization.name : null,
            this.getSelectionName(),
        ];

        return parts.filter(Boolean).join(' - ');
    }

    private getEmailAction() {
        return new AsyncTableAction({
            name: $t(`%1GW`),
            icon: 'send',
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
                name: $t('%1Lh'),
                icon: 'canceled',
                priority: 1,
                groupIndex: 4,
                enabled: () => !this.isSettingPaymentStatus,
                needsSelection: true,
                allowAutoSelectAll: false,
                destructive: true,
                handler: async (payments: PaymentGeneral[]) => {
                    const filteredPayments = payments.filter(payment => (payment.status === PaymentStatus.Pending || payment.status === PaymentStatus.Created) && (payment.method === PaymentMethod.Transfer || payment.method === PaymentMethod.PointOfSale));
                    if (filteredPayments.length === 0) {
                        Toast.error($t('%1NW')).show();
                        return;
                    }

                    const text = filteredPayments.length === 1 ? $t('%1KD') : $t('%1NX', { count: payments.length });
                    if (!await CenteredMessage.confirm(text, $t('%1Jy'), $t('%1KE'))) {
                        return;
                    }

                    await this.setPaymentStatus(PaymentStatus.Failed, filteredPayments);
                },
            });
        }
        return null;
    }

    /**
     * Refund a selection of online payments via the API of the payment provider (Mollie only).
     * The view itself splits the selection into what can and cannot be refunded.
     */
    private getRefundPaymentsAction(): TableAction<ObjectType> | null {
        if (!this.$feature('bulk-refund-payments')) {
            return null;
        }

        // The refunds run through the Mollie account of the organization: mollieOnboarding is
        // cleared as soon as that account is gone
        if (!this.organization?.privateMeta?.mollieOnboarding) {
            return null;
        }

        // A table that only lists methods that never pass through a payment provider (e.g. the
        // transfers to check) can never contain a payment that is refundable online
        if (this.methods && !this.methods.some(method => PaymentMethodHelper.isOnline(method))) {
            return null;
        }

        return new InMemoryTableAction({
            name: $t('%ZlG'),
            icon: 'undo',
            priority: 0,
            groupIndex: 4,
            needsSelection: true,
            allowAutoSelectAll: false,
            destructive: true,
            handler: async (payments: PaymentGeneral[]) => {
                if (payments.length === 0) {
                    return;
                }

                await this.present({
                    components: [
                        AsyncComponent(() => import('@stamhoofd/components/payments/RefundPaymentsView.vue'), {
                            payments,
                            onRefunded: this.reload,
                        }),
                    ],
                    modalDisplayStyle: 'popup',
                });
            },
        });
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

            const message = payments.length === 1 ? $t('%Mb') : $t('%1NY', { count: payments.length });
            Toast.success(message).setHide(1000).show();
        } catch (e) {
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
                        name: $t(`%1Lo`),
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
        } else {
            const organizationOption: RecipientMultipleChoiceOption = {
                type: 'MultipleChoice',
                name: $t('%1Ln'),
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

            if (this.platform.config.responsibilities.length === 0) {
                // Add all option
                const alternative: RecipientChooseOneOption = {
                    type: 'ChooseOne',
                    options: [
                        {
                            id: 'all',
                            name: $t(`%1TH`),
                            value: [
                                EmailRecipientSubfilter.create({
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
                                }),
                            ],
                        },
                        {
                            id: 'none',
                            name: $t(`%1QL`),
                            value: [],
                        },
                    ],
                };
                options.push(alternative);
            } else {
                options.push(organizationOption);
            }

            const otherPayments: RecipientChooseOneOption = {
                type: 'ChooseOne',
                options: [
                    {
                        id: 'all',
                        name: $t(`%1Lp`),
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
                        name: $t(`%1Lq`),
                        value: [],
                    },
                ],
            };

            options.push(otherPayments);
        }

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('@stamhoofd/components/email/EmailView.vue'), {
                recipientFilterOptions: options,
                supportsTranslations: this.organization?.language === null,
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
