import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { RenderContext, renderTemplate } from './AuditLogRenderer.js';
import { NamedObject } from './Event.js';
import wordDictionary from './data/audit-log-words.js';
import { Platform } from './Platform.js';
import { PaymentMethodHelper } from './PaymentMethod.js';
import { ParentTypeHelper } from './members/ParentType.js';
import { OrderStatusHelper } from './webshops/Order.js';
import { DocumentStatusHelper } from './Document.js';
import { AccessRightHelper } from './AccessRight.js';
import { CheckoutMethodTypeHelper } from './webshops/WebshopMetaData.js';
import { CountryHelper } from './addresses/CountryDecoder.js';
import { OrganizationTypeHelper } from './OrganizationType.js';
import { PaymentStatusHelper } from './PaymentStatus.js';
import { UmbrellaOrganizationHelper } from './UmbrellaOrganization.js';
import { STPackageTypeHelper } from './billing/STPackage.js';

export enum AuditLogType {
    /**
     * Used for legacy logs
     */
    Unknown = 'Unknown',
    MemberEdited = 'MemberEdited',
    MemberAdded = 'MemberAdded',
    MemberRegistered = 'MemberRegistered',
    MemberUnregistered = 'MemberUnregistered',
    PlatformSettingsChanged = 'PlatformSettingsChanged',
    OrganizationSettingsChanged = 'OrganizationSettingsChanged',

    // Events
    EventEdited = 'EventEdited',
    EventAdded = 'EventAdded',
    EventDeleted = 'EventDeleted',

    // Groups
    GroupEdited = 'GroupEdited',
    GroupAdded = 'GroupAdded',
    GroupDeleted = 'GroupDeleted',

    // Waiting lists
    WaitingListEdited = 'WaitingListEdited',
    WaitingListAdded = 'WaitingListAdded',
    WaitingListDeleted = 'WaitingListDeleted',

    // Periods
    RegistrationPeriodEdited = 'RegistrationPeriodEdited',
    RegistrationPeriodAdded = 'RegistrationPeriodAdded',
    RegistrationPeriodDeleted = 'RegistrationPeriodDeleted',

    // Stripe
    StripeAccountAdded = 'StripeAccountAdded',
    StripeAccountDeleted = 'StripeAccountDeleted',
    StripeAccountEdited = 'StripeAccountEdited',
}

export enum AuditLogReplacementType {
    Member = 'Member',
    Organization = 'Organization',
    Group = 'Group',
    Event = 'Event',
    Color = 'Color', // id is the color
    Image = 'Image', // id is the source url
    Key = 'Key', // translatable key
    Array = 'Array',
    RegistrationPeriod = 'RegistrationPeriod',
    Uuid = 'Uuid',
    StripeAccount = 'StripeAccount',
}

export function getAuditLogTypeName(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberEdited:
            return `Wijzigingen aan gegevens van leden`;
        case AuditLogType.MemberAdded:
            return `Nieuwe leden`;
        case AuditLogType.MemberRegistered:
            return `Inschrijvingen`;
        case AuditLogType.MemberUnregistered:
            return `Uitschrijvingen`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingsChanged:
            return `Wijzigingen aan platforminstellingen`;
        case AuditLogType.OrganizationSettingsChanged:
            return `Wijzigingen aan instellingen van een groep`;
        case AuditLogType.EventEdited:
            return `Wijzigingen aan activiteiten`;
        case AuditLogType.EventAdded:
            return `Nieuwe activiteiten`;
        case AuditLogType.EventDeleted:
            return `Verwijderde activiteiten`;
        case AuditLogType.GroupEdited:
            return `Wijzigingen aan groepen`;
        case AuditLogType.GroupAdded:
            return `Nieuwe groepen`;
        case AuditLogType.GroupDeleted:
            return `Verwijderde groepen`;
        case AuditLogType.WaitingListEdited:
            return `Wijzigingen aan wachtlijsten`;
        case AuditLogType.WaitingListAdded:
            return `Nieuwe wachtlijsten`;
        case AuditLogType.WaitingListDeleted:
            return `Verwijderde wachtlijsten`;
        case AuditLogType.RegistrationPeriodEdited:
            return `Wijzigingen aan werkjaren`;
        case AuditLogType.RegistrationPeriodAdded:
            return `Nieuwe werkjaren`;
        case AuditLogType.RegistrationPeriodDeleted:
            return `Verwijderde werkjaren`;
        case AuditLogType.StripeAccountAdded:
            return `Stripe account aangemaakt`;
        case AuditLogType.StripeAccountDeleted:
            return `Stripe account verwijderd`;
        case AuditLogType.StripeAccountEdited:
            return `Stripe account gewijzigd`;
    }

    return type;
}

export function getAuditLogTypeIcon(type: AuditLogType): [icon: string, subIcon?: string] {
    switch (type) {
        case AuditLogType.MemberEdited:
            return [`user`, `edit`];
        case AuditLogType.MemberAdded:
            return [`user`, 'add green'];
        case AuditLogType.MemberRegistered:
            return [`membership-filled`, `success`];
        case AuditLogType.MemberUnregistered:
            return [`membership-filled`, `canceled red`];
        case AuditLogType.PlatformSettingsChanged:
            return [`flag`, `settings`];
        case AuditLogType.OrganizationSettingsChanged:
            return [`settings`];
        case AuditLogType.Unknown:
            return [`help`];

        case AuditLogType.EventEdited:
            return [`calendar-filled`, `edit`];
        case AuditLogType.EventAdded:
            return [`calendar-filled`, `add green`];
        case AuditLogType.EventDeleted:
            return [`calendar-filled`, `canceled red`];

        case AuditLogType.GroupEdited:
            return [`group`, `edit`];
        case AuditLogType.GroupAdded:
            return [`group`, `add green`];
        case AuditLogType.GroupDeleted:
            return [`group`, `canceled red`];

        case AuditLogType.WaitingListEdited:
            return [`hourglass`, `edit`];
        case AuditLogType.WaitingListAdded:
            return [`hourglass`, `add green`];
        case AuditLogType.WaitingListDeleted:
            return [`hourglass`, `canceled red`];

        case AuditLogType.RegistrationPeriodEdited:
            return [`history`, `edit`];
        case AuditLogType.RegistrationPeriodAdded:
            return [`history`, `add green`];
        case AuditLogType.RegistrationPeriodDeleted:
            return [`history`, `canceled red`];

        case AuditLogType.StripeAccountAdded:
            return [`stripe`, `add green`];
        case AuditLogType.StripeAccountDeleted:
            return [`stripe`, `canceled red`];
        case AuditLogType.StripeAccountEdited:
            return [`stripe`, `edit`];
    }
    return [`help`];
}

function getAuditLogTypeTitleTemplate(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberAdded:
            return `{{m}} werd aangemaakt`;
        case AuditLogType.MemberEdited:
            return `De gegevens van {{m}} werden gewijzigd`;
        case AuditLogType.MemberRegistered:
            return `{{m}} werd ingeschreven voor {{g}}`;
        case AuditLogType.MemberUnregistered:
            return `{{m}} werd uitgeschreven voor {{g}}`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingsChanged:
            return `De platforminstellingen werden gewijzigd`;
        case AuditLogType.OrganizationSettingsChanged:
            return `De instellingen van {{o}} werden gewijzigd`;

        case AuditLogType.EventEdited:
            return `De activiteit {{e}} werd gewijzigd`;

        case AuditLogType.EventAdded:
            return `De activiteit {{e}} werd aangemaakt`;

        case AuditLogType.EventDeleted:
            return `De activiteit {{e}} werd verwijderd`;

        case AuditLogType.GroupEdited:
            return `De groep {{g}} werd gewijzigd`;

        case AuditLogType.GroupAdded:
            return `De groep {{g}} werd aangemaakt`;

        case AuditLogType.GroupDeleted:
            return `De groep {{g}} werd verwijderd`;

        case AuditLogType.WaitingListEdited:
            return `De wachtlijst {{g}} werd gewijzigd`;

        case AuditLogType.WaitingListAdded:
            return `De wachtlijst {{g}} werd aangemaakt`;

        case AuditLogType.WaitingListDeleted:
            return `De wachtlijst {{g}} werd verwijderd`;

        case AuditLogType.RegistrationPeriodEdited:
            return `Het werkjaar {{p}} werd gewijzigd`;

        case AuditLogType.RegistrationPeriodAdded:
            return `Het werkjaar {{p}} werd aangemaakt`;

        case AuditLogType.RegistrationPeriodDeleted:
            return `Het werkjaar {{p}} werd verwijderd`;

        case AuditLogType.StripeAccountAdded:
            return `Stripe account {{a}} aangemaakt`;
        case AuditLogType.StripeAccountDeleted:
            return `Stripe account {{a}} verwijderd`;
        case AuditLogType.StripeAccountEdited:
            return `Stripe account {{a}} gewijzigd`;
    }
}

function getTypeReplacements(type: AuditLogType): string[] {
    switch (type) {
        case AuditLogType.MemberAdded:
        case AuditLogType.MemberEdited:
            return ['m'];
        case AuditLogType.MemberRegistered:
        case AuditLogType.MemberUnregistered:
            return ['m', 'g'];
        case AuditLogType.OrganizationSettingsChanged:
            return ['o'];
        case AuditLogType.Unknown:
            return [];
        case AuditLogType.EventAdded:
        case AuditLogType.EventEdited:
        case AuditLogType.EventDeleted:
            return ['e'];
        case AuditLogType.GroupEdited:
        case AuditLogType.GroupAdded:
        case AuditLogType.GroupDeleted:
        case AuditLogType.WaitingListEdited:
        case AuditLogType.WaitingListAdded:
        case AuditLogType.WaitingListDeleted:
            return ['g'];

        case AuditLogType.RegistrationPeriodEdited:
        case AuditLogType.RegistrationPeriodAdded:
        case AuditLogType.RegistrationPeriodDeleted:
            return ['p'];

        case AuditLogType.StripeAccountAdded:
        case AuditLogType.StripeAccountDeleted:
        case AuditLogType.StripeAccountEdited:
            return ['a'];
        default:
            return [];
    }
}

export class AuditLogReplacement extends AutoEncoder {
    @field({ field: 'v', decoder: StringDecoder, optional: true })
    value: string = '';

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
                cleanedValues.push(v);
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

    static array(values: AuditLogReplacement[]) {
        const v = AuditLogReplacement.create({ values: values.flatMap(v => v.flatten()), type: AuditLogReplacementType.Array }).flatten();
        if (v.length === 1) {
            return v[0];
        }
        return AuditLogReplacement.create({ values: v, type: AuditLogReplacementType.Array });
    }

    static key(str: string | undefined | null) {
        if (!str) {
            return AuditLogReplacement.array([]);
        }
        return AuditLogReplacement.create({ value: str, type: AuditLogReplacementType.Key });
    }

    static uuid(id: string) {
        return AuditLogReplacement.create({
            id,
            value: uuidToName(id) || '',
            type: AuditLogReplacementType.Uuid,
        });
    }

    static string(str: string) {
        return AuditLogReplacement.create({ value: str });
    }

    toString() {
        if (this.type === AuditLogReplacementType.Key) {
            return getAuditLogPatchKeyName(this.value);
        }
        if (this.type === AuditLogReplacementType.Uuid) {
            if (this.id && !this.value) {
                const name = uuidToName(this.id);
                if (name) {
                    return name;
                }
                return '';
            }
        }

        if (this.type === AuditLogReplacementType.Array) {
            return this.values.map(v => v.toString()).filter(v => !!v).join(' → ');
        }
        return this.value;
    }
}

export function isUuid(value: unknown) {
    if (typeof value !== 'string') {
        return false;
    }
    return value.length === 36 && value[8] === '-' && value[13] === '-' && value[18] === '-' && value[23] === '-';
}

export function uuidToName(uuid: string) {
    // Look up in UUID library list
    const objectLists
     = [
         Platform.shared.config.premiseTypes,
         Platform.shared.config.eventTypes,
         Platform.shared.config.defaultAgeGroups,
         Platform.shared.config.tags,
         Platform.shared.config.recordsConfiguration.recordCategories,
     ];

    for (const list of objectLists) {
        for (const object of list) {
            if (object.id === uuid) {
                return object.name;
            }
        }
    }
    return null;
}

export function getAuditLogPatchKeyName(key: string) {
    // Strip prefixes
    const stripPrefixes = ['settings.', 'meta.', 'privateMeta.', 'privateConfig.', 'config.', 'privateSettings.'];
    for (const prefix of stripPrefixes) {
        if (key.startsWith(prefix)) {
            key = key.substring(prefix.length);
        }
    }

    if (wordDictionary[key]) {
        return wordDictionary[key];
    }

    const enumHelpers: ((key: string) => string)[] = [
        PaymentMethodHelper.getPluralName,
        ParentTypeHelper.getName,
        OrderStatusHelper.getName,
        DocumentStatusHelper.getName,
        AccessRightHelper.getName,
        CheckoutMethodTypeHelper.getName,
        CountryHelper.getName,
        OrganizationTypeHelper.getName,
        PaymentStatusHelper.getName,
        UmbrellaOrganizationHelper.getName,
        STPackageTypeHelper.getName,
        ParentTypeHelper.getName,
    ];

    for (const helper of enumHelpers) {
        try {
            const result = helper(key);
            if (result) {
                return result;
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    if (key.includes('.')) {
        const splitted = key.split('.');
        const firstWord = splitted[0];
        const remaining = splitted.slice(1).join('.');

        return `${getAuditLogPatchKeyName(firstWord)} → ${getAuditLogPatchKeyName(remaining)}`;
    }

    // Replace camel case with spaces
    key = key.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Replace _ case with spaces
    key = key.replace(/_+/g, ' ').trim();
    return key;
}
export enum AuditLogPatchItemType {
    Added = 'Added',
    Removed = 'Removed',
    Changed = 'Changed',
    Reordered = 'Reordered',
}

export class AuditLogPatchItem extends AutoEncoder {
    @field({ field: 'k', decoder: AuditLogReplacement })
    key: AuditLogReplacement;

    @field({ field: 'o', decoder: AuditLogReplacement, optional: true })
    oldValue?: AuditLogReplacement;

    @field({ field: 'v', decoder: AuditLogReplacement, optional: true })
    value?: AuditLogReplacement;

    @field({ field: 't', decoder: new EnumDecoder(AuditLogPatchItemType), optional: true })
    type?: AuditLogPatchItemType;

    autoType() {
        if (!this.oldValue && this.value) {
            this.type = AuditLogPatchItemType.Added;
        }
        else if (!this.value && this.oldValue) {
            this.type = AuditLogPatchItemType.Removed;
        }
        else {
            this.type = AuditLogPatchItemType.Changed;
        }
        return this;
    }
}

export class AuditLog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: new EnumDecoder(AuditLogType) })
    type: AuditLogType;

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    /**
     * The user who performed the action. Might get anonymized in case the user does not have permission to view who performed the action.
     */
    @field({ decoder: NamedObject, nullable: true })
    user: NamedObject | null;

    /**
     * The user who performed the action. Might get anonymized in case the user does not have permission to view who performed the action.
     */
    @field({ decoder: StringDecoder, nullable: true })
    objectId: string | null = null;

    /**
     * A custom description in case the patchList can't be used (try to avoid because these won't be translated)
     */
    @field({ decoder: StringDecoder })
    description: string = '';

    @field({ decoder: new MapDecoder(StringDecoder, AuditLogReplacement) })
    replacements: Map<string, AuditLogReplacement>;

    @field({ decoder: new ArrayDecoder(AuditLogPatchItem) })
    patchList: AuditLogPatchItem[] = [];

    @field({ decoder: DateDecoder })
    createdAt: Date;

    get renderableTitle() {
        try {
            return renderTemplate(getAuditLogTypeTitleTemplate(this.type), {
                type: 'text',
                context: Object.fromEntries(this.replacements.entries()),
                helpers: {
                    plural: (context: RenderContext, object: any, singular: string, plural: string) => {
                        if (object instanceof AuditLogReplacement) {
                            return object.count === 1 ? [singular] : [plural];
                        }
                        return [object === 1 ? singular : plural];
                    },
                },
            });
        }
        catch (e) {
            console.error('Invalid render template', e);
            return ['Onbekende actie'];
        }
    }

    get title() {
        return this.renderableTitle.map(v => v.toString()).join('');
    }

    get icon() {
        return getAuditLogTypeIcon(this.type)[0];
    }

    get subIcon() {
        return getAuditLogTypeIcon(this.type)[1];
    }

    validate() {
        const replacements = getTypeReplacements(this.type);
        for (const replacement of replacements) {
            if (!this.replacements.has(replacement)) {
                throw new Error(`Missing replacement ${replacement}`);
            }
        }
    }
}
