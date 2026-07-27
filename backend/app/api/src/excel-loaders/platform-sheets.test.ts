import type { XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { EventNotificationType, ExcelExportType, Organization, OrganizationMetaData, OrganizationTag, Platform, PlatformConfig, PlatformMembership, PlatformMembershipMemberDetails, PlatformMembershipOrganizationDetails, PlatformMembershipType, RecordCategory, RecordSettings, RecordType, TranslatedString } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import './index.js';

/**
 * The sheets are built per export request, so every callback should read the platform it was built
 * with instead of a process wide singleton.
 */
describe('Excel loaders platform argument', () => {
    function getColumns(type: ExcelExportType, platform: Platform, sheetId: string): XlsxTransformerColumn<unknown>[] {
        const loader = ExportToExcelEndpoint.loaders.get(type);

        if (!loader) {
            throw new Error('Loader ' + type + ' not registered');
        }

        const sheet = loader.getSheets(platform).find(s => s.id === sheetId);

        if (!sheet) {
            throw new Error('Sheet ' + sheetId + ' not found');
        }

        return sheet.columns;
    }

    function getColumn(type: ExcelExportType, platform: Platform, sheetId: string, columnId: string): XlsxTransformerConcreteColumn<unknown> {
        const column = getColumns(type, platform, sheetId).find(c => isXlsxTransformerConcreteColumn(c) && c.id === columnId);

        if (!column || !isXlsxTransformerConcreteColumn(column)) {
            throw new Error('Column ' + columnId + ' not found');
        }

        return column;
    }

    function createPlatformWithTag(tagName: string) {
        return Platform.create({
            config: PlatformConfig.create({
                tags: [
                    OrganizationTag.create({ id: 'tag-1', name: tagName }),
                ],
            }),
        });
    }

    it('reads the organization tags from the platform the sheets were built with', () => {
        const organization = Organization.create({
            meta: OrganizationMetaData.create({ tags: ['tag-1'] }),
        });

        const first = getColumn(ExcelExportType.Organizations, createPlatformWithTag('Gewest Noord'), 'organizations', 'tags');
        expect(first.getValue(organization).value).toBe('Gewest Noord');

        // Building the sheets again with another platform should not reuse the first platform
        const second = getColumn(ExcelExportType.Organizations, createPlatformWithTag('Gewest Zuid'), 'organizations', 'tags');
        expect(second.getValue(organization).value).toBe('Gewest Zuid');
    });

    it('reads the membership type from the platform the sheets were built with', () => {
        const platform = Platform.create({
            config: PlatformConfig.create({
                membershipTypes: [
                    PlatformMembershipType.create({ id: 'type-1', name: 'Aansluiting' }),
                ],
            }),
        });

        const membership = PlatformMembership.create({
            memberId: 'member-1',
            membershipTypeId: 'type-1',
            organizationId: 'organization-1',
            periodId: 'period-1',
            member: PlatformMembershipMemberDetails.create({ firstName: 'John', lastName: 'Doe', memberNumber: null }),
            organization: PlatformMembershipOrganizationDetails.create({}),
            balanceItem: null,
        });

        const column = getColumn(ExcelExportType.PlatformMemberships, platform, 'platform-memberships', 'type');
        expect(column.getValue(membership).value).toBe('Aansluiting');
    });

    it('reads the record categories of an event notification from the platform the sheets were built with', () => {
        const platform = Platform.create({
            config: PlatformConfig.create({
                eventNotificationTypes: [
                    EventNotificationType.create({
                        recordCategories: [
                            RecordCategory.create({
                                name: new TranslatedString('Kamp'),
                                records: [
                                    RecordSettings.create({
                                        id: 'record-1',
                                        name: new TranslatedString('Aantal deelnemers'),
                                        type: RecordType.Text,
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        });

        const columns = getColumns(ExcelExportType.EventNotifications, platform, 'event-notifications');
        const matched = columns.flatMap(c => isXlsxTransformerConcreteColumn(c) ? [] : (c.match('recordAnswers.record-1') ?? []));

        expect(matched).toHaveLength(1);
        expect(matched[0].name).toBe('Aantal deelnemers');
        expect(matched[0].category).toBe('Kamp');
    });
});
