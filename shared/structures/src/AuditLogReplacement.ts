import { ArrayDecoder, AutoEncoder, EnumDecoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DataValidator } from '@stamhoofd/utility';
import wordDictionary from './data/audit-log-words.js';

/**
 * The audit log dependes on a lot of other structures. To avoid creating circular dependencies
 * We inject them afterwards since these dependencies are only used at runtime
 */
export const AuditLogReplacementDependencies = {
    enumHelpers: [] as ((key: string) => string)[],
    uuidToName: (() => null) as (uuid: string) => string | null,
};

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
            return this.description || $t(`7495a021-71f6-464f-b742-4e79206f4d7f`);
        }

        if (this.type === AuditLogReplacementType.LongText) {
            return this.description || $t(`7495a021-71f6-464f-b742-4e79206f4d7f`);
        }

        if (this.type === AuditLogReplacementType.Image) {
            return $t(`31a0612a-b8a3-481d-9738-80be685a8680`);
        }

        if (this.type === AuditLogReplacementType.File) {
            return $t(`6e9064fc-f18e-40c7-b36b-e544a4801b2d`);
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
        for (const helper of AuditLogReplacementDependencies.enumHelpers) {
            try {
                const result = helper(key);
                if (result && result !== key) {
                    return result;
                }
            }
            catch (e) {
                console.error(e);
            }
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
