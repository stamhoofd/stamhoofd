import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, InMemoryTableAction, TableAction } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { ExcelExportType, PaymentGeneral } from '@stamhoofd/structures';
import { ComputedRef } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';
import { useMarkPaymentsPaid } from './hooks/useMarkPaymentsPaid';

type ObjectType = PaymentGeneral;

export function usePaymentActions({ configurationId }: { configurationId: ComputedRef<string> }) {
    const markPaid = useMarkPaymentsPaid();
    const present = usePresent();
    const selectableWorkbook = useSelectableWorkbook();

    return new PaymentActionBuilder({
        markPaid,
        present,
        selectableWorkbook,
        configurationId,
    });
}

export class PaymentActionBuilder {
    private present: ReturnType<typeof usePresent>;
    private markPaid: ReturnType<typeof useMarkPaymentsPaid>;
    private selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
    private configurationId: ComputedRef<string>;

    constructor(settings: {
        markPaid: ReturnType<typeof useMarkPaymentsPaid>;
        present: ReturnType<typeof usePresent>;
        selectableWorkbook: ReturnType<typeof useSelectableWorkbook>;
        configurationId: ComputedRef<string>;
    }) {
        this.markPaid = settings.markPaid;
        this.present = settings.present;
        this.selectableWorkbook = settings.selectableWorkbook;
        this.configurationId = settings.configurationId;
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
        ];

        return actions;
    }
}
