import { UIFilterBuilder } from '@stamhoofd/components';
import { ObjectWithRecords, OrganizationRecordsConfiguration, PatchAnswers, RecordCategory } from '@stamhoofd/structures';

export enum RecordEditorType {
    PlatformMember,
    Organization,
    Registration,
    Webshop,
    Document,
}

export class RecordEditorSettings<T extends ObjectWithRecords> {
    /**
     * Whether the record questions support sensitive data
     */
    dataPermission = false;
    toggleDefaultEnabled = false;

    exampleValue!: T;
    patchExampleValue!: (exampleValue: T, patch: PatchAnswers) => T;
    filterBuilder!: (categories: RecordCategory[]) => UIFilterBuilder;

    inheritedRecordsConfiguration: OrganizationRecordsConfiguration | null = null;
    type: RecordEditorType = RecordEditorType.PlatformMember;

    constructor(options: Partial<RecordEditorSettings<T>>) {
        Object.assign(this, options);
    }
}
