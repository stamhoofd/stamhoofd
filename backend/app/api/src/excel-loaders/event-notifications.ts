import { XlsxBuiltInNumberFormat, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { EventNotification, EventNotificationStatus, EventNotificationStatusHelper, ExcelExportType, LimitedFilteredRequest, Platform as PlatformStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetEventNotificationsEndpoint } from '../endpoints/global/events/GetEventNotificationsEndpoint';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<EventNotification, EventNotification> = {
    id: 'event-notifications',
    name: 'Meldingen',
    columns: [
        {
            id: 'id',
            name: 'ID',
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.id,
            }),
        },
        {
            id: 'name',
            name: 'Naam activiteit',
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.events.map(e => e.name).join(', '),
            }),
        },
        {
            id: 'organization.name',
            name: 'Groep',
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: 'Groepsnummer',
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.uri,
            }),
        },
        {
            id: 'status',
            name: 'Status',
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)),
            }),
        },
        {
            id: 'feedbackText',
            name: 'Opmerkingen',
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
            name: 'Startdatum',
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
            name: 'Einddatum',
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
            name: 'Ingediend op',
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
            name: 'Ingediend door',
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
