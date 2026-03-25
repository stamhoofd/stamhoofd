import type { UIFilterBuilder } from '#filters/UIFilter.ts';
import type { ObjectWithRecords, OrganizationRecordsConfiguration, RecordCategory } from '@stamhoofd/structures';

export enum RecordEditorType {
    PlatformMember = 'PlatformMember',
    Organization = 'Organization',
    Registration = 'Registration',
    Webshop = 'Webshop',
    Document = 'Document',
    EventNotification = 'EventNotification',
}

export class RecordEditorSettings<T extends ObjectWithRecords> {
    /**
     * Whether the record questions support sensitive data
     */
    dataPermission = false;
    toggleDefaultEnabled = false;

    exampleValue!: T;
    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder;

    inheritedRecordsConfiguration: OrganizationRecordsConfiguration | null = null;
    type: RecordEditorType = RecordEditorType.PlatformMember;

    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options);
    }
}
