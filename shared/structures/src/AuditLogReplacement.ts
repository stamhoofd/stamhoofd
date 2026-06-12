import { ArrayDecoder, AutoEncoder, EnumDecoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DataValidator } from '@stamhoofd/utility';
import wordDictionary from './data/audit-log-words.js';

type AuditLogEnumObject<T extends string = string> = Record<string, T>;
type AuditLogEnumRegistration<T extends string = string> = {
    type: string;
    enumObject: AuditLogEnumObject<T>;
    getName: (key: T) => string;
};

/**
 * The audit log dependes on a lot of other structures. To avoid creating circular dependencies
 * We inject them afterwards since these dependencies are only used at runtime
 */
export const AuditLogReplacementDependencies = {
    /**
     * @deprecated Only used for old audit log data that stored enum values as Key replacements.
     * It can be removed some time after backend/app/api/src/seeds/1780416000-migrate-audit-log-legacy-enums.ts
     * has been rolled out everywhere.
     */
    enumHelpers: [] as ((key: string) => string)[],
    enumHelpersByType: new Map<string, (key: string) => string>(),
    enumTypes: new Map<object, string>(),
    legacyEnums: [] as AuditLogEnumRegistration[],
    uuidToName: (() => null) as (uuid: string) => string | null,
};

export function registerAuditLogEnum<T extends string>(type: string, enumObject: AuditLogEnumObject<T>, getName: (key: T) => string, options?: { legacy?: boolean }) {
    if (AuditLogReplacementDependencies.enumHelpersByType.has(type)) {
        throw new Error(`Audit log enum type is already registered: ${type}`);
    }

    if (AuditLogReplacementDependencies.enumTypes.has(enumObject)) {
        throw new Error(`Audit log enum object is already registered: ${AuditLogReplacementDependencies.enumTypes.get(enumObject)}`);
    }

    const stringGetName = (key: string) => {
        if (!isAuditLogEnumValue(enumObject, key)) {
            return key;
        }

        return getName(key);
    };

    AuditLogReplacementDependencies.enumHelpersByType.set(type, stringGetName);
    AuditLogReplacementDependencies.enumTypes.set(enumObject, type);

    if (options?.legacy) {
        AuditLogReplacementDependencies.enumHelpers.push(stringGetName);
        AuditLogReplacementDependencies.legacyEnums.push({ type, enumObject, getName });
    }
}

function isAuditLogEnumValue<T extends string>(enumObject: AuditLogEnumObject<T>, key: string): key is T {
    return Object.values(enumObject).some(value => value === key);
}

export function getAuditLogEnumType(enumObject: object): string | undefined {
    return AuditLogReplacementDependencies.enumTypes.get(enumObject);
}

export function getAuditLogEnumDecoderObject(decoder: EnumDecoder<any>): object {
    const enumObject: unknown = decoder.enum;
    if (typeof enumObject === 'object' && enumObject !== null) {
        return enumObject;
    }

    throw new Error('Expected enum decoder to contain an enum object');
}

export function getRegisteredAuditLogEnums(): { type: string; enumObject: object }[] {
    return Array.from(AuditLogReplacementDependencies.enumTypes.entries()).map(([enumObject, type]) => ({ type, enumObject }));
}

/**
 * @deprecated Only used to migrate old audit log data that stored enum values as Key replacements.
 * It can be removed some time after backend/app/api/src/seeds/1780416000-migrate-audit-log-legacy-enums.ts
 * has been rolled out everywhere.
 */
export function getLegacyAuditLogEnumRegistrations(): { type: string; enumObject: AuditLogEnumObject; getName: (key: string) => string }[] {
    return AuditLogReplacementDependencies.legacyEnums.slice();
}

/**
 * @deprecated Only used to migrate old audit log data that stored enum values as Key replacements.
 * It can be removed some time after backend/app/api/src/seeds/1780416000-migrate-audit-log-legacy-enums.ts
 * has been rolled out everywhere.
 */
export function getLegacyAuditLogEnumReplacement(key: string): AuditLogReplacement | null {
    if (wordDictionary[key]) {
        return null;
    }

    const legacyName = getLegacyAuditLogEnumName(key);
    if (!legacyName) {
        return null;
    }

    for (const { type, enumObject, getName } of AuditLogReplacementDependencies.legacyEnums) {
        if (!Object.values(enumObject).includes(key)) {
            continue;
        }

        try {
            const result = getName(key);
            if (result === legacyName) {
                return AuditLogReplacement.enum(type, key) ?? null;
            }
        } catch (e) {
            console.error(e);
        }
    }

    return null;
}

/**
 * @deprecated Only used for old audit log data that stored enum values as Key replacements.
 * It can be removed some time after backend/app/api/src/seeds/1780416000-migrate-audit-log-legacy-enums.ts
 * has been rolled out everywhere.
 */
function getLegacyAuditLogEnumName(key: string): string | null {
    for (const helper of AuditLogReplacementDependencies.enumHelpers) {
        try {
            const result = helper(key);
            if (result && result !== key) {
                return result;
            }
        } catch (e) {
            console.error(e);
        }
    }

    return null;
}

export enum AuditLogReplacementType {
    // Base
    Key = 'Key', // translatable key
    Array = 'Array',
    Uuid = 'Uuid',
    Color = 'Color', // id is the color
    Image = 'Image', // id is the source url
    File = 'File', // id is the source url
    Html = 'Html',
    LongText = 'LongText', // Expandable text
    Enum = 'Enum', // id is the enum type, value is the enum value

    // Objects
    Member = 'Member',
    User = 'User',
    Organization = 'Organization',
    Group = 'Group',
    Event = 'Event',
    RegistrationPeriod = 'RegistrationPeriod',
    StripeAccount = 'StripeAccount',
    Webshop = 'Webshop',
    Order = 'Order',
    Payment = 'Payment',
    PlatformMembershipType = 'PlatformMembershipType',
    MemberResponsibility = 'MemberResponsibility',
    DocumentTemplate = 'DocumentTemplate',
    Email = 'Email',
    EmailAddress = 'EmailAddress',
    EmailTemplate = 'EmailTemplate',
    EventNotification = 'EventNotification',
}

export class AuditLogReplacement extends AutoEncoder {
    @field({ field: 'v', decoder: StringDecoder, optional: true })
    value: string = '';

    @field({ field: 'd', decoder: StringDecoder, optional: true })
    description: string = '';

    @field({ field: 'a', decoder: new ArrayDecoder(AuditLogReplacement), optional: true })
    values: AuditLogReplacement[] = [];

    /**
     * Helps to make an object clickable
     */
    @field({ field: 'i', decoder: StringDecoder, optional: true })
    id?: string;

    /**
     * Helps to make an object clickable
     */
    @field({ field: 't', decoder: new EnumDecoder(AuditLogReplacementType), optional: true })
    type?: AuditLogReplacementType;

    /**
     * Helps to determine if this object is plural or not
     */
    @field({ field: 'c', decoder: NumberDecoder, optional: true })
    count?: number;

    flatten() {
        if (this.type === AuditLogReplacementType.Array) {
            const cleanedValues: AuditLogReplacement[] = [];
            for (const v of this.values.flatMap(v => v.flatten())) {
                if (v.type === AuditLogReplacementType.Key) {
                    const last = cleanedValues[cleanedValues.length - 1];
                    if (last && last.type === AuditLogReplacementType.Key) {
                        if (last.value) {
                            last.value += '.';
                        }
                        last.value += v.value;
                        continue;
                    }
                }
                cleanedValues.push(v.clone());
            }
            return cleanedValues;
        }
        return [this];
    }

    prepend(add?: AuditLogReplacement | null) {
        if (!add) {
            return this;
        }
        return AuditLogReplacement.array([...add.flatten(), this]);
    }

    append(add?: AuditLogReplacement | null) {
        if (!add) {
            return this;
        }
        return AuditLogReplacement.array([this, ...add.flatten()]);
    }

    static join(...values: (AuditLogReplacement | undefined | null)[]) {
        return AuditLogReplacement.array(values);
    }

    static array(values: (AuditLogReplacement | undefined | null)[]) {
        const v = AuditLogReplacement.create({ values: values.flatMap(v => v?.flatten() ?? []), type: AuditLogReplacementType.Array }).flatten();
        if (v.length === 1) {
            return v[0];
        }
        return AuditLogReplacement.create({ values: v, type: AuditLogReplacementType.Array });
    }

    static key(str: string | undefined | null) {
        if (!str) {
            return AuditLogReplacement.empty();
        }
        return AuditLogReplacement.create({ value: str, type: AuditLogReplacementType.Key });
    }

    static enum(type: string, value: string | number | undefined | null) {
        if (value === undefined || value === null) {
            return undefined;
        }

        return AuditLogReplacement.create({ id: type, value: String(value), type: AuditLogReplacementType.Enum });
    }

    static empty() {
        return AuditLogReplacement.array([]);
    }

    static uuid(id: string) {
        return AuditLogReplacement.create({
            id,
            value: AuditLogReplacementDependencies.uuidToName(id) || '',
            type: AuditLogReplacementType.Uuid,
        });
    }

    static string(str: string) {
        return AuditLogReplacement.create({ value: str });
    }

    static html(str: string, title?: string) {
        return AuditLogReplacement.create({ value: str, type: AuditLogReplacementType.Html, description: title });
    }

    static longText(str: string, title?: string) {
        return AuditLogReplacement.create({ value: str, type: AuditLogReplacementType.LongText, description: title });
    }

    toString(): string {
        if (this.type === AuditLogReplacementType.Key || this.type === AuditLogReplacementType.EmailTemplate) {
            return getAuditLogPatchKeyName(this.value);
        }

        if (this.type === AuditLogReplacementType.Enum) {
            const helper = this.id ? AuditLogReplacementDependencies.enumHelpersByType.get(this.id) : undefined;
            if (helper) {
                const result = helper(this.value);
                if (result && result !== this.value) {
                    return result;
                }
            }

            return getAuditLogPatchKeyName(this.value);
        }

        if (this.type === AuditLogReplacementType.Uuid || (this.id && !this.value && DataValidator.isUuid(this.id))) {
            if (this.id && !this.value) {
                const name = AuditLogReplacementDependencies.uuidToName(this.id);
                if (name) {
                    return name;
                }
                return '';
            }
        }

        if (this.type === AuditLogReplacementType.Array) {
            return this.values.map(v => v.toString()).filter(v => !!v).join(' → ');
        }

        if (this.type === AuditLogReplacementType.Html) {
            return this.description || $t(`%lZ`);
        }

        if (this.type === AuditLogReplacementType.LongText) {
            return this.description || $t(`%lZ`);
        }

        if (this.type === AuditLogReplacementType.Image) {
            return $t(`%la`);
        }

        if (this.type === AuditLogReplacementType.File) {
            return $t(`%yU`);
        }
        return this.value;
    }

    toKey(): string {
        if (this.type === AuditLogReplacementType.Array) {
            return this.values.map(v => v.toKey()).filter(v => !!v).join('.');
        }
        return this.value;
    }

    lastValue(): string {
        if (this.type === AuditLogReplacementType.Array && this.values.length > 0) {
            return this.values[this.values.length - 1].lastValue();
        }
        if (this.type === AuditLogReplacementType.Key) {
            return this.value.split('.').pop() || '';
        }
        return this.value;
    }
}

export function getAuditLogPatchKeyName(key: string) {
    // Strip prefixes
    const stripPrefixes = ['settings.', 'meta.', 'privateMeta.', 'privateConfig.', 'config.', 'privateSettings.', 'details.', 'data.'];
    for (const prefix of stripPrefixes) {
        if (key.startsWith(prefix)) {
            key = key.substring(prefix.length);
        }
    }

    if (wordDictionary[key]) {
        return wordDictionary[key];
    }

    // Check first letter is a capital letter
    if (key.length > 1 && key[0] === key[0].toUpperCase()) {
        const legacyEnumName = getLegacyAuditLogEnumName(key);
        if (legacyEnumName) {
            return legacyEnumName;
        }
    }

    if (key.includes('.')) {
        const splitted = key.split('.');

        if (splitted.length > 2) {
            const firstTwoWords = splitted.slice(0, 2).join('.');
            if (firstTwoWords !== getAuditLogPatchKeyName(firstTwoWords)) {
                return `${getAuditLogPatchKeyName(firstTwoWords)} → ${getAuditLogPatchKeyName(splitted.slice(2).join('.'))}`;
            }
        }

        const firstWord = splitted[0];
        const remaining = splitted.slice(1).join('.');

        return `${getAuditLogPatchKeyName(firstWord)} → ${getAuditLogPatchKeyName(remaining)}`;
    }

    if (key.length > 2 && key.endsWith('Id')) {
        // Strip id and try again
        return getAuditLogPatchKeyName(key.substring(0, key.length - 2));
    }

    // Replace camel case with spaces
    key = key.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Replace _ case with spaces
    key = key.replace(/_+/g, ' ').trim();
    return key;
}
