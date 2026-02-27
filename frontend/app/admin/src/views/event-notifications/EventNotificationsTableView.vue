<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <template #empty>
            {{ $t('4fa242b7-c05d-44d4-ada5-fb60e91af818') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, EmailView, ModernTableView, TableAction, TableActionSelection, useEventNotificationBackendFilterBuilders, useEventNotificationsObjectFetcher, usePlatform, useTableObjectFetcher } from '@stamhoofd/components';
import { EventNotificationViewModel } from '@stamhoofd/components/event-notifications/classes/EventNotificationViewModel.ts';
import EventNotificationView from '@stamhoofd/components/event-notifications/EventNotificationView.vue';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { EventNotification, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, ExcelExportType, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import { getSelectableWorkbook } from './getSelectableWorkbook';

type ObjectType = EventNotification;

const props = withDefaults(
    defineProps<{
        type?: EventNotificationType | null;
    }>(),
    {
        type: null,
    },
);

const title = computed(() => {
    if (props.type) {
        return props.type.title;
    }
    return $t('f86bcf9f-ffd2-429a-9b04-778e61c8288c');
});

const estimatedRows = computed(() => {
    return 30;
});

const present = usePresent();
const platform = usePlatform();
const getFilterBuilders = useEventNotificationBackendFilterBuilders();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'event-notifications';
});
const filterBuilders = computed(() => getFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.type) {
        return {
            typeId: props.type.id,
        };
    }

    return null;
}

const defaultFilter = {
    $not: {
        status: {
            $in: [EventNotificationStatus.Draft, EventNotificationStatus.Accepted],
        },
    },
};

const objectFetcher = useEventNotificationsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<EventNotification>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, Date | null>({
        id: 'submittedAt',
        name: $t('16c87ee7-27b1-4b87-93e3-221d35038e6a'),
        getValue: e => e.submittedAt,
        format: d => d ? Formatter.date(d, true) : $t('faf32311-9a1c-4659-8156-e1714071ca68'),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, Date>({
        id: 'startDate',
        name: $t('86983e38-4283-4f0a-bd1d-f48f050d3681'),
        getValue: e => e.startDate,
        format: d => Formatter.date(d, true),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, Date>({
        id: 'endDate',
        name: $t('c15040b1-3202-45a8-8d30-030a4e4c5f9c'),
        getValue: e => e.endDate,
        format: d => Formatter.date(d, true),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, string>({
        id: 'event.name',
        name: $t('8e2f97c0-0687-4b50-91f1-2b0e266de755'),
        getValue: e => e.events.map(e => e.name).join(', '),
        minimumWidth: 200,
        recommendedWidth: 100,
        index: 0,
        allowSorting: false,
        grow: true,
    }),

    new Column<ObjectType, EventNotificationStatus>({
        id: 'status',
        name: $t('fde0cfa6-c279-4eef-ab75-8f62fd4028a8'),
        getValue: organization => organization.status,
        format: status => Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(status)),
        getStyle: (status) => {
            if (status === EventNotificationStatus.Draft) {
                return 'gray';
            }
            if (status === EventNotificationStatus.Accepted) {
                return 'success';
            }
            if (status === EventNotificationStatus.Rejected) {
                return 'error';
            }
            return '';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, string>({
        id: 'organization.name',
        name: $t('87a2582f-6de5-4b59-9395-7c49f8540659'),
        getValue: notification => notification.organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),

    new Column<ObjectType, string>({
        id: 'organization.uriPadded',
        name: $t('5dd0bc69-83ba-4ee7-99e9-141d0cdf5a84'),
        getValue: notification => notification.organization.uri,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),
];

const Route = {
    Component: EventNotificationView,
    objectKey: 'event-notification',
    getProperties: (object: ObjectType) => {
        return {
            viewModel: EventNotificationViewModel.edit({
                eventNotification: object,
                platform: platform.value,
            }),
        };
    },
};

const actions: TableAction<EventNotification>[] = [];

async function openMail(selection: TableActionSelection<EventNotification>) {
    if ((true as any)) {
        throw new SimpleError({
            code: 'not_implemented',
            message: 'Not implemented',
            human: $t(`63d685f9-57f4-4cef-bdd2-c1ec5d3af778`),
        });
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailView, {
            recipientFilterOptions: [],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

async function exportToExcel(selection: TableActionSelection<ObjectType>) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ExcelExportView, {
                    type: ExcelExportType.EventNotifications,
                    filter: selection.filter,
                    workbook: getSelectableWorkbook(platform.value),
                    configurationId: configurationId.value,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

actions.push(new AsyncTableAction({
    name: $t(`f92ad3ab-8743-4d37-8b3f-c9d5ca756b16`),
    icon: 'email',
    priority: 12,
    groupIndex: 3,
    handler: async (selection: TableActionSelection<EventNotification>) => {
        await openMail(selection);
    },
}));

actions.push(
    new AsyncTableAction({
        name: $t(`0302eaa0-ce2a-4ef0-b652-88b26b9c53e9`),
        icon: 'download',
        priority: 11,
        groupIndex: 3,
        handler: async (selection) => {
            await exportToExcel(selection);
        },
    }),
);
</script>
