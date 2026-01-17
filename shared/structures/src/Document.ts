import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { NamedObject } from './Event.js';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler } from './filters/InMemoryFilter.js';
import { documentInMemoryFilterCompilers } from './filters/inMemoryFilterDefinitions.js';
import { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { ObjectWithRecords, PatchAnswers } from './members/ObjectWithRecords.js';
import { RecordAnswer, RecordAnswerDecoder } from './members/records/RecordAnswer.js';
import { RecordCategory } from './members/records/RecordCategory.js';
import { RecordSettings } from './members/records/RecordSettings.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';

export enum DocumentStatus {
    Draft = 'Draft',
    MissingData = 'MissingData',
    Published = 'Published',
    Deleted = 'Deleted',
}
export class DocumentStatusHelper {
    static getName(status: DocumentStatus): string {
        switch (status) {
            case DocumentStatus.Draft: return $t(`a4b33491-0ace-4b39-aba6-79371659fd51`);
            case DocumentStatus.MissingData: return $t(`21b3891d-7c0e-49ca-ae35-d77d54e9f0c3`);
            case DocumentStatus.Published: return $t(`362f9b8f-9f87-49bc-8dda-d6014ab9de3f`);
            case DocumentStatus.Deleted: return $t(`fb738914-5429-4d24-9eac-564caa299996`);
        }
    }

    static getColor(status: DocumentStatus): string {
        switch (status) {
            case DocumentStatus.Draft: return 'info';
            case DocumentStatus.MissingData: return 'tertiary';
            case DocumentStatus.Published: return 'secundary';
            case DocumentStatus.Deleted: return 'error';
        }
    }
}
export class DocumentSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, version: 178 })
    name = '';

    @field({ decoder: IntegerDecoder, nullable: true })
    maxAge: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    minPrice: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, version: 348 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    minPricePaid: number | null = null;

    /**
     * Fields defined by the template that can be set.
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 252,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>();
            for (const answer of old) {
                map.set(answer.settings.id, answer);
            }
            return map;
        },
    })
    fieldAnswers: Map<string, RecordAnswer> = new Map();

    /**
     * Defines where to automatically find the answer for a given question
     */
    @field({ decoder: new MapDecoder(StringDecoder, new ArrayDecoder(StringDecoder)) })
    linkedFields: Map<string, string[]> = new Map();
}

export class DocumentTemplateDefinition extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, version: 194, upgrade: () => 'fiscal' })
    type: string | null = null;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: new ArrayDecoder(RecordCategory) })
    fieldCategories: RecordCategory[] = [];

    /**
     * Questions filled out for each selected group / cycle combination
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    groupFieldCategories: RecordCategory[] = [];

    /**
     * Questions that are different for each document. They can be linked to specific fields of members later on for automatic linking.
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    documentFieldCategories: RecordCategory[] = [];

    @field({ decoder: IntegerDecoder, nullable: true })
    defaultMaxAge: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    defaultMinPrice: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, version: 348 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    defaultMinPricePaid: number | null = null;

    @field({ decoder: BooleanDecoder, version: 347 })
    allowChangingMaxAge = false;

    @field({ decoder: BooleanDecoder, version: 347 })
    allowChangingMinPrice = false;

    @field({ decoder: BooleanDecoder, version: 348 })
    allowChangingMinPricePaid = false;

    @field({ decoder: new ArrayDecoder(RecordCategory), version: 179 })
    exportFieldCategories: RecordCategory[] = [];

    @field({ decoder: StringDecoder, nullable: true, version: 179 })
    xmlExport: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 179 })
    xmlExportDescription: string | null = null;

    transformForDiff() {
        // Exclude from all diffs
        return null;
    }
}

export class DocumentTemplateGroup extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, field: 'groupId' })
    @field({ decoder: NamedObject, version: 344, upgrade: (old: any) => NamedObject.create({ id: old, name: $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`) }) })
    group: NamedObject;

    /**
     * @deprecated
     */
    @field({ decoder: NumberDecoder })
    cycle = 0;

    /**
     * Answers for groupFieldCategories for this group
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 252,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>();
            for (const answer of old) {
                map.set(answer.settings.id, answer);
            }
            return map;
        },
    })
    fieldAnswers: Map<string, RecordAnswer> = new Map();

    getDiffName() {
        return this.group.name;
    }

    isRecordEnabled(_record: RecordSettings): boolean {
        return true;
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.fieldAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as DocumentTemplateGroup).patch({
            fieldAnswers: patch,
        }) as this;
    }
}

export class DocumentPrivateSettings extends AutoEncoder {
    @field({ decoder: DocumentTemplateDefinition })
    templateDefinition = DocumentTemplateDefinition.create({});

    /**
     * Groups for which the members will receive the document
     */
    @field({ decoder: new ArrayDecoder(DocumentTemplateGroup) })
    groups: DocumentTemplateGroup[] = [];

    @field({ decoder: BooleanDecoder, version: 343 })
    customHtml = false;
}

export class DocumentTemplatePrivate extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(DocumentStatus) })
    status: DocumentStatus = DocumentStatus.Draft;

    @field({ decoder: BooleanDecoder })
    updatesEnabled = true;

    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: DocumentSettings })
    settings = DocumentSettings.create({});

    @field({ decoder: DocumentPrivateSettings })
    privateSettings = DocumentPrivateSettings.create({});

    @field({ decoder: NumberDecoder, version: 391 })
    year: number;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder })
    updatedAt = new Date();

    isRecordEnabled(_record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.settings.fieldAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as DocumentTemplatePrivate).patch({
            settings: DocumentSettings.patch({
                fieldAnswers: patch,
            }),
        }) as this;
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        try {
            const recordAnswerFilters = {
                ...baseInMemoryFilterCompilers,
            };
            for (const a of this.settings.fieldAnswers.values()) {
                recordAnswerFilters[a.settings.id] = createInMemoryFilterCompiler([a.settings.id, 'objectValue']);
            }
            const defs = {
                ...documentInMemoryFilterCompilers,
                fieldAnswers: createInMemoryFilterCompiler('settings.fieldAnswers', recordAnswerFilters),
            };

            const compiledFilter = compileToInMemoryFilter(filter, defs);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }
}

/**
 * Data stored with a document
 */
export class DocumentData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    /**
     * Contains a snapshot of all the answers
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 252,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>();
            for (const answer of old) {
                map.set(answer.settings.id, answer);
            }
            return map;
        },
    })
    fieldAnswers: Map<string, RecordAnswer> = new Map();
}

export class Document extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: NumberDecoder, nullable: true, version: 179 })
    number: number | null = null;

    @field({ decoder: new EnumDecoder(DocumentStatus) })
    status: DocumentStatus = DocumentStatus.Draft;

    @field({ decoder: DocumentData })
    data = DocumentData.create({});

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder })
    updatedAt = new Date();

    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    registrationId: string | null = null;

    @field({ decoder: StringDecoder })
    templateId: string;

    isRecordEnabled(_record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.data.fieldAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as Document).patch({
            data: DocumentData.patch({
                fieldAnswers: patch,
            }),
        }) as this;
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, documentInMemoryFilterCompilers);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }
}
