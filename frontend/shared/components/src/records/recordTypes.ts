import { RecordChoice, RecordSettings, RecordType, TranslatedString } from '@stamhoofd/structures';
import { ContextMenuItem } from '../overlays/ContextMenu';

export function getRecordTypeIcon(type: RecordType): string {
    switch (type) {
        case RecordType.Textarea: return 'paragraph';
        case RecordType.Checkbox: return 'check-box';
        case RecordType.ChooseOne: return 'radio-list';
        case RecordType.MultipleChoice: return 'check-list';
        case RecordType.Email: return 'email';
        case RecordType.Address: return 'location';
        case RecordType.Date: return 'calendar';
        case RecordType.Phone: return 'smartphone';
        case RecordType.Integer: return 'calculator';
        case RecordType.Price: return 'receive';
        case RecordType.Image: return 'image';
        case RecordType.File: return 'file';
        default: return 'text-style';
    }
}

export function getRecordTypeGroups(): { name: string; types: { type: RecordType; name: string }[] }[] {
    return [
        {
            name: $t('%110'),
            types: [
                { type: RecordType.Text, name: $t('%111') },
                { type: RecordType.Textarea, name: $t('%112') },
                { type: RecordType.Email, name: $t('%1FK') },
                { type: RecordType.Phone, name: $t('%wD') },
            ],
        },
        {
            name: $t('%1JG'),
            types: [
                { type: RecordType.Address, name: $t('%Cn') },
                { type: RecordType.Date, name: $t('%7R') },
                { type: RecordType.Integer, name: $t('%113') },
                { type: RecordType.Price, name: $t('%1IP') },
            ],
        },
        {
            name: $t('%114'),
            types: [
                { type: RecordType.Checkbox, name: $t('%115') },
                { type: RecordType.ChooseOne, name: $t('%116') },
                { type: RecordType.MultipleChoice, name: $t('%117') },
            ],
        },
        {
            name: $t('%HQ'),
            types: [
                { type: RecordType.Image, name: $t('%118') },
                { type: RecordType.File, name: $t('%yU') },
            ],
        },
    ];
}

/**
 * Checkboxes and multiple choice questions can be left empty, so they start optional
 */
export function isRecordTypeRequiredByDefault(type: RecordType) {
    return type !== RecordType.MultipleChoice && type !== RecordType.Checkbox;
}

export function createDefaultRecordChoices() {
    return [
        RecordChoice.create({ name: TranslatedString.create($t('%11K')) }),
        RecordChoice.create({ name: TranslatedString.create($t('%11L')) }),
    ];
}

export function createRecordOfType(type: RecordType) {
    return RecordSettings.create({
        type,
        required: isRecordTypeRequiredByDefault(type),
        choices: type === RecordType.ChooseOne || type === RecordType.MultipleChoice ? createDefaultRecordChoices() : [],
    });
}

/**
 * One menu item per record type, grouped like the type dropdown of the record editor
 */
export function getRecordTypeMenuItems(action: (type: RecordType) => unknown): ContextMenuItem[][] {
    return getRecordTypeGroups().map(group => group.types.map(t => new ContextMenuItem({
        name: t.name,
        icon: getRecordTypeIcon(t.type),
        action: () => action(t.type),
    })));
}
