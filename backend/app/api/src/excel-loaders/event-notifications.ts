import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import type { EventNotification, LimitedFilteredRequest} from '@stamhoofd/structures';
import { EventNotificationStatus, EventNotificationStatusHelper, ExcelExportType, Platform as PlatformStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetEventNotificationsEndpoint } from '../endpoints/global/events/GetEventNotificationsEndpoint.js';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<EventNotification, EventNotification> = {
    id: 'event-notifications',
    name: $t(`%1FR`),
    columns: [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.id,
            }),
        },
        {
            id: 'name',
            name: $t(`%w9`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.events.map(e => e.name).join(', '),
            }),
        },
        {
            id: 'organization.name',
            name: $t(`%wA`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`%1O1`),
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.uri,
            }),
        },
        {
            id: 'status',
            name: $t(`%1A`),
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)),
            }),
        },
        {
            id: 'feedbackText',
            name: $t(`%YT`),
            width: 80,
            getValue: (notification: EventNotification) => ({
                value: notification.status !== EventNotificationStatus.Accepted ? notification.feedbackText : null,
                style: {
                    alignment: {
                        wrapText: true,
                    },
                },
            }),
        },
        {
            id: 'startDate',
            name: $t(`%1Of`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.startDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'endDate',
            name: $t(`%1P8`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.endDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'submittedAt',
            name: $t(`%Aw`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.submittedAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'submittedBy',
            name: $t(`%wC`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.submittedBy?.name ?? '',
            }),
        },

        // Dynamic records
        XlsxTransformerColumnHelper.createRecordAnswersColumns({
            matchId: 'recordAnswers',
            getRecordAnswers: (notification: EventNotification) => notification.recordAnswers,
            getRecordCategories: () => {
                const platform = PlatformStruct.shared;
                return platform.config.eventNotificationTypes.flatMap(r => r.recordCategories);
            },
        }),
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.EventNotifications, {
    fetch: async (query: LimitedFilteredRequest) => {
        return await GetEventNotificationsEndpoint.buildData(query);
    },
    sheets: [
        sheet,
    ],
});
