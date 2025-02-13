import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';

import { ResolutionRequest } from '../../files/ResolutionRequest.js';
import { PropertyFilter } from '../../filters/PropertyFilter.js';
import { getPermissionLevelNumber, PermissionLevel } from '../../PermissionLevel.js';
import { ObjectWithRecords } from '../ObjectWithRecords.js';
import { type RecordAnswer } from './RecordAnswer.js';

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
            name: 'Tekstveld (één lijn)',
        },
        {
            value: RecordType.Textarea,
            name: 'Tekstveld (meerdere lijnen)',
        },
        {
            value: RecordType.Address,
            name: 'Adres',
        },
        {
            value: RecordType.Email,
            name: 'E-mailadres',
        },
        {
            value: RecordType.Phone,
            name: 'Telefoonnummer',
        },
        {
            value: RecordType.Date,
            name: 'Datum',
        },
        {
            value: RecordType.Checkbox,
            name: 'Aankruisvakje',
        },
        {
            value: RecordType.ChooseOne,
            name: 'Keuzemenu (kies één)',
        },
        {
            value: RecordType.MultipleChoice,
            name: 'Keuzemenu (kies meerdere)',
        },
        {
            value: RecordType.File,
            name: 'Bestand',
        },
    ];
    return all.find(t => t.value === type)?.name ?? 'Onbekend';
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
    text = '';

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
    name = '';

    @field({ decoder: StringDecoder, version: 118 })
    description = '';

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
    name = '';
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
    label = '';

    /**
     * Text underneath the label in case of a checkbox.
     * For other types: below the input
     */
    @field({ decoder: StringDecoder })
    description = '';

    /// In case of textboxes or comments for checked checkboxes
    @field({ decoder: StringDecoder })
    inputPlaceholder = '';

    /// Text below the input field for comments (if any)
    @field({ decoder: StringDecoder, version: 120 })
    commentsDescription = '';

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
            return 'Verplicht ' + type;
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
                message: 'Dit veld is verplicht',
                field: this.id,
            });
        }

        if (answer) {
            answer.validate();
        }
    }

    checkPermissionForUserManager(level: PermissionLevel) {
        return getPermissionLevelNumber(this.externalPermissionLevel) >= getPermissionLevelNumber(level);
    }

    get excelColumns() {
        if (this.type === RecordType.Address) {
            return [
                this.name + ' - Straat en nummer',
                this.name + ' - Postcode',
                this.name + ' - Gemeente',
                this.name + ' - Land',
            ];
        }
        return [this.name];
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
