<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :prefix-column="null" :Route="Route">
        <template #empty>
            {{ $t('%77') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import EmailView, { type RecipientChooseOneOption, type RecipientMultipleChoiceOption } from '@stamhoofd/components/email/EmailView.vue';
import { getCachedOutstandingBalanceUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import ReceivableBalanceView from '@stamhoofd/components/payments/ReceivableBalanceView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useReceivableBalancesObjectFetcher } from '@stamhoofd/components/fetchers/useReceivableBalancesObjectFetcher.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { ReceivableBalance, StamhoofdFilter } from '@stamhoofd/structures';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, getReceivableBalanceTypeName, mergeFilters, ReceivableBalanceType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref} from 'vue';
import { computed, ref } from 'vue';
import { useSelectableWorkbook } from './getSelectableWorkbook';

type ObjectType = ReceivableBalance;

const present = usePresent();
const owner = useRequestOwner();
const platform = usePlatform();
const $feature = useFeatureFlag();
const organization = useOrganization();
const props = withDefaults(
    defineProps<{
        objectType?: ReceivableBalanceType | null;
    }>(),
    {
        objectType: null,
    },
);

const title = computed(() => {
    return $t('%99');
});

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'receivable-balances';
});
const filterBuilders = getCachedOutstandingBalanceUIFilterBuilders();

function getRequiredFilter(): StamhoofdFilter | null {
    if (!props.objectType) {
        return {
            objectType: {
                $in: $feature('organization-receivable-balances') ? [ReceivableBalanceType.member, ReceivableBalanceType.userWithoutMembers, ReceivableBalanceType.organization] : [ReceivableBalanceType.member, ReceivableBalanceType.userWithoutMembers],
            },
            $or: {
                amountOpen: { $neq: 0 },
                amountPending: { $neq: 0 },
                nextDueAt: { $neq: null },
            },
        };
    }

    return {
        objectType: props.objectType,
        $or: {
            amountOpen: { $neq: 0 },
            amountPending: { $neq: 0 },
            nextDueAt: { $neq: null },
        },
    };
}

const objectFetcher = useReceivableBalancesObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'name',
        name: $feature('organization-receivable-balances') ? 'Schuldenaar' : 'Lid',
        getValue: object => object.object.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    ...($feature('organization-receivable-balances')
        ? [
                new Column<ObjectType, string | null>({
                    id: 'uri',
                    name: '#',
                    getValue: object => object.object.uri,
                    format: value => value || 'Geen',
                    getStyle: value => !value ? 'gray' : '',
                    minimumWidth: 100,
                    recommendedWidth: 200,
                    allowSorting: false,
                }),
            ]
        : []),

    ...($feature('organization-receivable-balances')
        ? [
                new Column<ObjectType, string | null>({
                    id: 'type',
                    name: $t('%1LP'),
                    getValue: object => Formatter.capitalizeFirstLetter(getReceivableBalanceTypeName(object.objectType)),
                    format: value => value || 'Geen',
                    getStyle: value => !value ? 'gray' : '',
                    minimumWidth: 70,
                    recommendedWidth: 120,
                    allowSorting: false,
                }),
            ]
        : []),

    new Column<ObjectType, number>({
        id: 'amountOpen',
        name: 'Openstaand bedrag',
        getValue: object => object.amountOpen,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, number>({
        id: 'amountPending',
        name: 'In verwerking',
        getValue: object => object.amountPending,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

];

const { getSelectableWorkbook } = useSelectableWorkbook();

const actions: TableAction<ObjectType>[] = [
    new AsyncTableAction({
        name: 'Exporteer naar Excel',
        icon: 'download',
        priority: 11,
        groupIndex: 3,
        needsSelection: true,
        allowAutoSelectAll: true,
        handler: async (selection) => {
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(ExcelExportView, {
                            type: ExcelExportType.ReceivableBalances,
                            filter: selection.filter,
                            workbook: getSelectableWorkbook(),
                            configurationId: configurationId.value,
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
        },
    }),
];

const Route = {
    Component: ReceivableBalanceView,
    objectKey: 'item',
};

async function openMail(selection: TableActionSelection<ObjectType>) {
    const filter = selection.filter.filter;
    const search = selection.filter.search;

    const memberOptions: RecipientChooseOneOption = {
        type: 'ChooseOne',
        name: $t('%1EH'),
        options: [
            {
                id: 'accounts',
                name: $t('%L8'),
                value: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.ReceivableBalances,
                        filter: mergeFilters([filter, {
                            objectType: {
                                $neq: ReceivableBalanceType.organization,
                            },
                        }]),
                        search,
                    }),
                ],
            },
        ],
    };

    const organizationOption: RecipientMultipleChoiceOption = {
        type: 'MultipleChoice',
        name: $t('%1HI'),
        options: [],
        defaultSelection: organization.value?.privateMeta?.balanceNotificationSettings.getOrganizationContactsFilterResponsibilityIds() ?? [],
        build: (selectedIds: string[]) => {
            if (selectedIds.length === 0) {
                return [];
            }

            const q = EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.ReceivableBalances,
                filter: mergeFilters([filter, {
                    objectType: ReceivableBalanceType.organization,
                }]),
                search,
                subfilter: {
                    meta: {
                        responsibilityIds: {
                            $in: selectedIds,
                        },
                    },
                },
            });

            return [
                q,
            ];
        },
    };

    for (const responsibility of platform.value.config.responsibilities) {
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

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailView, {
            recipientFilterOptions: $feature('organization-receivable-balances') ? [memberOptions, organizationOption] : [memberOptions],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

actions.push(new AsyncTableAction({
    name: 'E-mailen',
    icon: 'email',
    priority: 12,
    groupIndex: 3,
    handler: async (selection: TableActionSelection<ObjectType>) => {
        await openMail(selection);
    },
}));

// Listen for patches in payments
GlobalEventBus.addListener(owner, 'paymentPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

GlobalEventBus.addListener(owner, 'balanceItemPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

</script>
