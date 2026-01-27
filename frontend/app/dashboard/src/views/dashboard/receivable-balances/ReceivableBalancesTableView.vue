<template>
    <ModernTableView ref="modernTableView" :table-object-fetcher="tableObjectFetcher" :filter-builders="filterBuilders" :title="title" :column-configuration-id="configurationId" :actions="actions" :all-columns="allColumns" :prefix-column="null" :Route="Route">
        <template #empty>
            {{ $t('0637e394-fbd7-42ea-9a1b-5acdcc86419a') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, EmailView, getCachedOutstandingBalanceUIFilterBuilders, GlobalEventBus, ModernTableView, ReceivableBalanceView, RecipientChooseOneOption, RecipientMultipleChoiceOption, TableAction, TableActionSelection, useFeatureFlag, useOrganization, usePlatform, useReceivableBalancesObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { useRequestOwner } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, getReceivableBalanceTypeName, mergeFilters, ReceivableBalance, ReceivableBalanceType, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
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
    return $t('e09c97db-85d7-40b0-8043-65fa24a09a01');
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
                    name: $t('70bf2b13-2ff0-4d64-bcfe-524e89bc4b96'),
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
        name: $t('672a6035-da6d-403b-a31e-242cdd92cc5b'),
        options: [
            {
                id: 'accounts',
                name: $t('bc8a585c-6670-418c-ba88-228157009d44'),
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
        name: $t('da4e80d0-e482-4cef-80a6-c49e445b0f4e'),
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
