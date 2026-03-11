import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

import { ResolutionRequest } from '../../files/ResolutionRequest.js';
import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { getPermissionLevelNumber, PermissionLevel } from '../../PermissionLevel.js';
import { ObjectWithRecords } from '../ObjectWithRecords.js';
import { type RecordAnswer } from './RecordAnswer.js';
import { TranslatedString } from '../../TranslatedString.js';

export type RecordFilterOptions = { level?: PermissionLevel; additionalFilter?: (record: RecordSettings) => boolean };

export enum RecordType {
    /**
     * Show a checkbox to the user so they can check the value on/off
     * It is possible to add a textarea as soon as the checkbox is selected if the extra property is set.
     */
    Checkbox = 'Checkbox',

    /**
     * Select one (or none if not required)
     */
    ChooseOne = 'ChooseOne',

    /**
     * Select one, zero or more from a menu
     * The way this is shown will differ depending on the minimum or maximum setting. e.g. when exactly one
     * item should be selected, we could show it with a dropdown menu
     */
    MultipleChoice = 'MultipleChoice',

    /**
     * Small text input
     */
    Text = 'Text',

    /**
     * Big text input
     */
    Textarea = 'Textarea',

    /**
     * Address input
     */
    Address = 'Address',

    Phone = 'Phone',
    Email = 'Email',

    Date = 'Date',
    Price = 'Price',
    Image = 'Image',
    File = 'File',
    Integer = 'Integer',
}

export enum FileType {
    PDF = 'PDF',
    Word = 'Word',
    Excel = 'Excel',
}

export function getRecordTypeName(type: RecordType) {
    const all = [
        {
            value: RecordType.Text,
            name: $t(`668f1663-e8d1-4e1c-9397-32a1c2b70022`),
        },
        {
            value: RecordType.Textarea,
            name: $t(`99cf6d44-681c-450b-8c5c-74bc75ca0cde`),
        },
        {
            value: RecordType.Address,
            name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
        },
        {
            value: RecordType.Email,
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
        },
        {
            value: RecordType.Phone,
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
        },
        {
            value: RecordType.Date,
            name: $t(`112b7686-dffc-4ae9-9706-e3efcd34898f`),
        },
        {
            value: RecordType.Checkbox,
            name: $t(`be247511-3af8-4006-b944-19db50d75a89`),
        },
        {
            value: RecordType.ChooseOne,
            name: $t(`0c57da32-95ac-4e64-a61a-0a7fa104294a`),
        },
        {
            value: RecordType.MultipleChoice,
            name: $t(`06f06102-d0a6-4b23-84b0-43d53fc87ca1`),
        },
        {
            value: RecordType.File,
            name: $t(`108e2ee2-0c29-4f5e-9c34-b9030dd369b9`),
        },
    ];
    return all.find(t => t.value === type)?.name ?? $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
}

export enum RecordWarningType {
    Info = 'Info',
    Warning = 'Warning',
    Error = 'Error',
}

export class RecordWarning extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    text = TranslatedString.create();

    @field({ decoder: new EnumDecoder(RecordWarningType) })
    type = RecordWarningType.Info;

    /**
     * Show a warning if the associated value is falsy
     */
    @field({ decoder: BooleanDecoder })
    inverted = false;

    static get sort() {
        return (warning1: RecordWarning, warning2: RecordWarning) => {
            const priority1 = warning1.type;
            const priority2 = warning2.type;

            if ((priority1 === RecordWarningType.Error && priority2 === RecordWarningType.Warning)
                || (priority1 === RecordWarningType.Warning && priority2 === RecordWarningType.Info)
                || (priority1 === RecordWarningType.Error && priority2 === RecordWarningType.Info)) {
                return -1;
            }
            else if ((priority1 === RecordWarningType.Info && priority2 === RecordWarningType.Warning)
                || (priority1 === RecordWarningType.Warning && priority2 === RecordWarningType.Error)
                || (priority1 === RecordWarningType.Info && priority2 === RecordWarningType.Error)) {
                return 1;
            }
            else {
                return 0;
            }
        };
    }

    get icon() {
        switch (this.type) {
            case RecordWarningType.Error: return ' exclamation-two red';
            case RecordWarningType.Warning: return ' exclamation yellow';
            case RecordWarningType.Info: return ' info-text';
        }
    }
}

export class RecordChoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    name = TranslatedString.create();

    @field({ decoder: StringDecoder, version: 118 })
    @field(TranslatedString.field({ version: 370 }))
    description = TranslatedString.create();

    /**
     * Show a warning if selected (or not selected if inverted)
     */
    @field({ decoder: RecordWarning, version: 122, nullable: true })
    warning: RecordWarning | null = null;
}

export class BaseRecordSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Short name (used mainly for displaying the information)
     */
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    name = TranslatedString.create();
}

export class RecordSettings extends BaseRecordSettings {
    /**
     * When used with checkbox: checkbox needs to get checked (e.g accept terms, confirm age...)
     * Multiple choice: minimum one selection required
     * Text: required input
     */
    @field({ decoder: BooleanDecoder })
    required = true;

    /**
     * Whether you need permission to collect this information
     */
    @field({ decoder: BooleanDecoder, version: 123 })
    sensitive = false;

    /**
     * Only used for checkboxes
     */
    @field({ decoder: BooleanDecoder, version: 119 })
    askComments = false;

    @field({ decoder: new EnumDecoder(RecordType) })
    type = RecordType.Text;

    /**
     * In case of multiple choice: the values you can choose from with optional additional information
     */
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    choices: RecordChoice[] = [];

    /**
     * Label used for input (depending on the type)
     * Checkbox: text next to checkbox
     * Text inputs: label field above the input
     * If empty: name is used
     */
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    label = TranslatedString.create();

    /**
     * Text underneath the label in case of a checkbox.
     * For other types: below the input
     */
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    description = TranslatedString.create();

    /// In case of textboxes or comments for checked checkboxes
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    inputPlaceholder = TranslatedString.create();

    /// Text below the input field for comments (if any)
    @field({ decoder: StringDecoder, version: 120 })
    @field(TranslatedString.field({ version: 370 }))
    commentsDescription = TranslatedString.create();

    /**
     * Show a warning if selected / entered (or not selected/entered if inverted)
     */
    @field({ decoder: RecordWarning, version: 122, nullable: true })
    warning: RecordWarning | null = null;

    /**
     * Only for images
     */
    @field({ decoder: new ArrayDecoder(ResolutionRequest), optional: true })
    resolutions?: ResolutionRequest[];

    /**
     * Only for files
    */
    @field({ decoder: new EnumDecoder(FileType), nullable: true, optional: true })
    fileType?: FileType | null;

    @field({ decoder: new EnumDecoder(PermissionLevel), version: 356 })
    externalPermissionLevel = PermissionLevel.Write;

    @field({ decoder: PropertyFilter, version: 365, nullable: true, optional: true })
    filter: PropertyFilter | null = null;

    getDiffValue() {
        const type = getRecordTypeName(this.type);
        if (this.required) {
            return $t(`bbe18b42-bbd7-4c1f-9f1c-367b27e5c18d`) + ' ' + type;
        }
        return type;
    }

    validate(answers: Map<string, RecordAnswer>, requiredCategory = true) {
        const answer = answers.get(this.id);

        if (!requiredCategory && (!answer || answer.isEmpty)) {
            // Okay to skip
            return;
        }

        if (this.required && !answer) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`22531919-79f1-466f-b58d-30f709973ffb`),
                field: this.id,
            });
        }

        if (answer) {
            if (answer.settings.type !== this.type) {
                throw new SimpleError({
                    code: 'field_type_changed',
                    message: $t(`621c533c-23fe-43b5-b493-a4352ac479d2`),
                    field: this.id,
                });
            }
            answer.settings = this;
            answer.validate();
        }
    }

    checkPermissionForUserManager(level: PermissionLevel) {
        return getPermissionLevelNumber(this.externalPermissionLevel) >= getPermissionLevelNumber(level);
    }

    get excelColumns(): { name: string; width?: number; defaultCategory?: string }[] {
        if (this.type === RecordType.Address) {
            let prefix = '';
            const defaultCategory = $t('0a37de09-120b-4bea-8d13-6d7ed6823884');
            if (this.name.toString() !== defaultCategory) {
                prefix = this.name + ' - ';
            }

            return [
                {
                    name: prefix + $t('780f327b-5a25-497f-b741-7d0b1a659db9'),
                    defaultCategory, // Ignore this name
                    width: 40,
                },
                {
                    name: prefix + $t('89eafa94-6447-4608-a71e-84752eab10c8'),
                    defaultCategory, // Ignore this name
                    width: 20,
                },
                {
                    name: prefix + $t('28b0f035-cb44-48b7-b60f-093f6adc26fb'),
                    defaultCategory, // Ignore this name
                    width: 20,
                },
                {
                    name: prefix + $t('3f4f6c6a-e2c5-4bee-83a3-77d8e55a1e60'),
                    defaultCategory, // Ignore this name
                    width: 20,
                },
                {
                    name: prefix + $t('b1064996-ca77-48d0-b178-4bbd6af44e8e'),
                    defaultCategory, // Ignore this name
                    width: 20,
                },
            ];
        }

        let width = 20;

        switch (this.type) {
            case RecordType.Image:
            case RecordType.File:
                width = 115;
                break;
            case RecordType.Textarea:
                width = 80;
                break;
            case RecordType.Email:
                width = 40;
                break;
        }

        return [{
            name: this.name.toString(),
            width,
        }];
    }

    isEnabled<T extends ObjectWithRecords>(filterValue: T, options?: RecordFilterOptions): boolean {
        if (options?.level) {
            const level = options?.level;
            if (!this.checkPermissionForUserManager(level)) {
                return false;
            }
        }

        if (options?.additionalFilter) {
            if (!options.additionalFilter(this)) {
                return false;
            }
        }

        if (this.filter && !this.filter?.isEnabled(filterValue)) {
            return false;
        }

        return !!filterValue.isRecordEnabled(this);
    }

    duplicate() {
        const c = this.clone();
        c.id = uuidv4();
        return c;
    }
}
