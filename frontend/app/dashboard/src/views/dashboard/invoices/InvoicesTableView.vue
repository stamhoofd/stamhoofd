<template>
    <ModernTableView
        ref="modernTableView"
        :prefix-column="allColumns[0]"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :default-sort-column="allColumns.find(c => c.id === 'number')"
        :default-filter="defaultFilter"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :route
    >
        <template #empty>
            {{ $t('%1J9') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { useInvoicesObjectFetcher } from '@stamhoofd/components/fetchers/useInvoicesObjectFetcher.ts';
import { usePaymentsUIFilterBuilders } from '@stamhoofd/components/filters/filter-builders/payments.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import type { TableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { InMemoryTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import { AppManager } from '@stamhoofd/networking/AppManager';
import type { Invoice, InvoiceStruct, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { InvoicesExcelExport } from './InvoicesExcelExport';
import InvoiceView from '@stamhoofd/components/payments/InvoiceView.vue';

const props = withDefaults(
    defineProps<{
        defaultFilter?: StamhoofdFilter | null;
    }>(), {
        defaultFilter: null,
    },
);

type ObjectType = Invoice;

const configurationId = computed(() => {
    return 'invoices';
});

const organization = useOrganization();
const platform = usePlatform();
const filterBuilders = usePaymentsUIFilterBuilders();
const title = computed(() => {
    return $t('%1JA');
});

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        number: {
            $neq: null,
        },
    };
}

const objectFetcher = useInvoicesObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'number', /** Note that we use a different id here because that causes us to sort on invoicedAt instead of number, which is faster and more stable (date instead of string) */
        name: '#',
        getValue: object => object.number ?? '',
        getStyleForObject: (object, isPrefix) => {
            if (!isPrefix) {
                return '';
            }
            return 'info';
        },
        minimumWidth: 100,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, string>({
        id: 'customer',
        name: $t('%1J1'),
        getValue: object => object.customer?.company ? (object.customer?.company?.name || '') : (object.customer.name || ''),
        format: value => value || $t('%CL'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.VATNumber',
        name: $t('%1CK'),
        getValue: object => object.customer?.company ? (object.customer?.company?.VATNumber || '') : '',
        format: value => value || $t('%1FW'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 150,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'customer.company.companyNumber',
        name: $t('%wa'),
        getValue: object => object.customer?.company ? (object.customer?.company?.companyNumber || '') : '',
        format: value => value || $t('%1FW'),
        getStyle: value => !value ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 150,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, Date | null>({
        id: 'invoicedAt',
        name: $t('%7R'),
        getValue: object => object.invoicedAt,
        format: (value, width) => value ? (width < 150 ? Formatter.dateNumber(value) : Formatter.date(value, true)) : $t('%1JB'),
        minimumWidth: 120,
        recommendedWidth: 120,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithVAT',
        name: $t('%1JC'),
        getValue: object => object.totalWithVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'totalWithoutVAT',
        name: $t('%1JD'),
        getValue: object => object.totalWithoutVAT,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, number>({
        id: 'VATTotalAmount',
        name: $t('%1JE'),
        getValue: object => object.VATTotalAmount,
        format: value => Formatter.price(value),
        minimumWidth: 50,
        recommendedWidth: 100,
    }),

    new Column<ObjectType, boolean>({
        id: 'didSendPeppol',
        name: $t('Doorgestuurd'),
        description: $t('Doorgestuurd naar boekhoudsoftware'),
        getValue: object => object.didSendPeppol,
        getStyle: (value) => {
            if (!value) {
                return 'gray';
            }
            return '';
        },
        format: value => value ? $t('Ja') : $t('Nee'),
        minimumWidth: 50,
        recommendedWidth: 400,
        enabled: false,
        allowSorting: false,
    }),

    ...(STAMHOOFD.userMode === 'organization' && organization.value && organization.value.id === platform.value.membershipOrganizationId
        ? [
                new Column<ObjectType, string | null>({
                    id: 'reference',
                    name: $t('Referentie'),
                    getValue: object => object.reference,
                    getStyle: (value) => {
                        if (!value) {
                            return 'gray';
                        }
                        return '';
                    },
                    format: value => value || $t('Geen'),
                    minimumWidth: 200,
                    recommendedWidth: 300,
                    enabled: false,
                    allowSorting: false,
                }),

                new Column<ObjectType, string | null>({
                    id: 'stripeAccountId',
                    name: 'Stripe account ID',
                    getValue: object => object.stripeAccountId,
                    getStyle: (value) => {
                        if (!value) {
                            return 'gray';
                        }
                        return '';
                    },
                    format: value => value || $t('Geen'),
                    minimumWidth: 200,
                    recommendedWidth: 300,
                    enabled: false,
                    allowSorting: false,
                }),
            ]
        : []),

];

const route = {
    component: async () => (await import('@stamhoofd/components/payments/InvoiceView.vue')).default,
    objectKey: 'invoice',
};

const actions: TableAction<ObjectType>[] = [
    new InMemoryTableAction({
        name: $t(`%1B7`),
        icon: 'download',
        priority: 5,
        groupIndex: 2,
        needsSelection: true,
        allowAutoSelectAll: true,
        handler: async (invoices: ObjectType[]) => {
            if (invoices.length === 1) {
                showInvoice(invoices[0]);
            } else {
                await downloadInvoices(invoices);
            }
        },
    }),

    /* new AsyncTableAction({
        name: $t('%V8'),
        icon: 'download',
        priority: 0,
        groupIndex: 2,
        needsSelection: true,
        allowAutoSelectAll: true,
        handler: async (selection) => {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(ExcelExportView, {
                            type: ExcelExportType.Payments,
                            filter: selection.filter,
                            workbook: getSelectableWorkbook(),
                            configurationId: configurationId.value,
                            title: [organization.value?.name, $t('Facturen')].filter(Boolean).join(' - '),
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        },
    }), */
];

function showInvoice(invoice: Invoice) {
    if (invoice.pdf === null) {
        new CenteredMessage($t('%1Qt'), $t('%1Rp'), 'error').addCloseButton().show();
        return;
    }
    if (invoice.xml) {
        AppManager.shared.downloadFile(new URL(invoice.xml.getPublicPath()), invoice.number + '.xml').catch(console.error);
    } else {
        window.open(invoice.pdf.getPublicPath(), '_blank');
    }
}

const downloading = ref(false);
async function downloadInvoices(invoices: Invoice[], onlyVAT?: boolean) {
    if (downloading.value) {
        return;
    }

    if (onlyVAT === undefined) {
        const v = await CenteredMessage.show({
            title: $t('%1Rq'),
            description: $t(`%1SZ`),
            buttons: [
                {
                    text: $t('%1U5'),
                    type: 'primary',
                    value: true,
                },
                {
                    text: $t('%1Qy'),
                    type: 'secundary',
                    value: false,
                },
                {
                    text: $t('%1Lh'),
                    type: 'secundary',
                    value: null,
                },
            ],
        });
        if (v === null) {
            return;
        }
        onlyVAT = v;
    }
    downloading.value = true;

    try {
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
        const zip = new JSZip();

        const groups = new Map<string, InvoiceStruct[]>();

        // Group per month
        for (const invoice of invoices) {
            const date = invoice.invoicedAt; // meta.date ?? invoice.paidAt ?? invoice.createdAt

            if (!date) {
                throw new Error('Missing invoicedAt date');
            }

            const year = date.getFullYear();
            const monthString = year + '-' + ((date.getMonth() + 1) + '').padStart(2, '0') + ' ' + Formatter.capitalizeFirstLetter(Formatter.month(date.getMonth() + 1));

            const group = groups.get(monthString) ?? [];
            group.push(invoice);
            groups.set(monthString, group);
        }

        for (const [month, group] of groups) {
            // Create an Excel file
            const folder = zip.folder(month);
            if (!folder) {
                throw new Error('Failed to create folder');
            }

            // Sort group based on number here
            group.sort((a, b) => Sorter.byStringValue(b.number ?? '0', a.number ?? '0'));

            const excel = await InvoicesExcelExport.export(group);
            folder.file('0000-overzicht-' + month + '.xlsx', excel);

            for (const invoice of group) {
                if (!invoice.pdf) {
                    throw new Error('PDF ontbreekt voor factuur ' + (invoice.number ?? invoice.id));
                }

                if (onlyVAT) {
                    if (!invoice.customer.company?.VATNumber) {
                        continue;
                    }
                }
                const data = await fetch(invoice.pdf!.getPublicPath());
                const blob = await data.blob();
                folder.file(
                    (invoice.number + '').padStart(4, '0') + ' - ' + Formatter.dateIso(invoice.invoicedAt!) + ' - ' + Formatter.fileSlug(invoice.customer.dynamicName) + '.pdf',
                    blob,
                );

                if (invoice.xml) {
                    const data = await fetch(invoice.xml!.getPublicPath());
                    const blob = await data.blob();
                    folder.file(
                        (invoice.number + '').padStart(4, '0') + ' - ' + Formatter.dateIso(invoice.invoicedAt!) + ' - ' + Formatter.fileSlug(invoice.customer.dynamicName) + '.xml',
                        blob,
                    );
                }
            }
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'Facturen.zip');
    } catch (e) {
        Toast.fromError(e).show();
    }
    downloading.value = false;
}

</script>
