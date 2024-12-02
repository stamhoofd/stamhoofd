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
import { getGroupStatusName } from './Group.js';
import { getGenderName } from './members/Gender.js';
import { getSetupStepName } from './SetupStepType.js';
import { Formatter } from '@stamhoofd/utility';

export enum AuditLogSource {
    User = 'User',
    System = 'System',

    /**
     * Caused by a change in payment status
     */
    Payment = 'Payment',

    /**
     * E.g. orders placed via a webshop.
     */
    Anonymous = 'Anonymous',
}

export enum AuditLogType {
    /**
     * Used for legacy logs
     */
    Unknown = 'Unknown',
    MemberRegistered = 'MemberRegistered',
    MemberUnregistered = 'MemberUnregistered',
    PlatformSettingsChanged = 'PlatformSettingsChanged',

    OrganizationAdded = 'OrganizationAdded',
    OrganizationDeleted = 'OrganizationDeleted',
    OrganizationEdited = 'OrganizationEdited',

    // Events
    EventEdited = 'EventEdited',
    EventAdded = 'EventAdded',
    EventDeleted = 'EventDeleted',

    // Members
    MemberEdited = 'MemberEdited',
    MemberAdded = 'MemberAdded',
    MemberDeleted = 'MemberDeleted',

    // Groups
    GroupEdited = 'GroupEdited',
    GroupAdded = 'GroupAdded',
    GroupDeleted = 'GroupDeleted',

    // Webshops
    WebshopEdited = 'WebshopEdited',
    WebshopAdded = 'WebshopAdded',
    WebshopDeleted = 'WebshopDeleted',

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

    // Orders
    OrderAdded = 'OrderAdded',
    OrderEdited = 'OrderEdited',
    OrderDeleted = 'OrderDeleted',

    // Payment
    PaymentAdded = 'PaymentAdded',
    PaymentEdited = 'PaymentEdited',
    PaymentDeleted = 'PaymentDeleted',

    // Document templates
    DocumentTemplateAdded = 'DocumentTemplateAdded',
    DocumentTemplateEdited = 'DocumentTemplateEdited',
    DocumentTemplateDeleted = 'DocumentTemplateDeleted',

    // Users
    UserAdded = 'UserAdded',
    UserEdited = 'UserEdited',
    UserDeleted = 'UserDeleted',

    // MemberResponsibilityRecord
    MemberResponsibilityRecordAdded = 'MemberResponsibilityRecordAdded',
    MemberResponsibilityRecordEdited = 'MemberResponsibilityRecordEdited',
    MemberResponsibilityRecordDeleted = 'MemberResponsibilityRecordDeleted',

    // MemberPlatformMembership
    MemberPlatformMembershipAdded = 'MemberPlatformMembershipAdded',
    MemberPlatformMembershipEdited = 'MemberPlatformMembershipEdited',
    MemberPlatformMembershipDeleted = 'MemberPlatformMembershipDeleted',
}

export enum AuditLogReplacementType {
    Member = 'Member',
    User = 'User',
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
    Webshop = 'Webshop',
    Order = 'Order',
    Payment = 'Payment',
    PlatformMembershipType = 'PlatformMembershipType',
    MemberResponsibility = 'MemberResponsibility',
}

export function getAuditLogTypeName(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberEdited:
            return `Wijzigingen aan gegevens van leden`;
        case AuditLogType.MemberAdded:
            return `Nieuwe leden`;
        case AuditLogType.MemberDeleted:
            return `Verwijderde leden`;
        case AuditLogType.MemberRegistered:
            return `Inschrijvingen`;
        case AuditLogType.MemberUnregistered:
            return `Uitschrijvingen`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingsChanged:
            return `Wijzigingen aan platforminstellingen`;
        case AuditLogType.OrganizationEdited:
            return `Wijzigingen aan instellingen van een groep`;
        case AuditLogType.OrganizationAdded:
            return `Nieuwe lokale groepen`;
        case AuditLogType.OrganizationDeleted:
            return `Verwijderde lokale groepen`;
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
        case AuditLogType.WebshopEdited:
            return `Wijzigingen aan webshops`;
        case AuditLogType.WebshopAdded:
            return `Nieuwe webshops`;
        case AuditLogType.WebshopDeleted:
            return `Verwijderde webshops`;
        case AuditLogType.OrderAdded:
            return `Nieuwe bestellingen`;
        case AuditLogType.OrderEdited:
            return `Wijzigingen aan bestellingen`;
        case AuditLogType.OrderDeleted:
            return `Verwijderde bestellingen`;
        case AuditLogType.PaymentAdded:
            return `Nieuwe betalingen`;
        case AuditLogType.PaymentEdited:
            return `Wijzigingen aan betalingen`;
        case AuditLogType.PaymentDeleted:
            return `Verwijderde betalingen`;
        case AuditLogType.DocumentTemplateAdded:
            return `Nieuwe document`;
        case AuditLogType.DocumentTemplateEdited:
            return `Wijzigingen aan documenten`;
        case AuditLogType.DocumentTemplateDeleted:
            return `Verwijderde documenten`;
        case AuditLogType.UserAdded:
            return `Nieuwe accounts`;
        case AuditLogType.UserEdited:
            return `Wijzigingen aan accounts`;
        case AuditLogType.UserDeleted:
            return `Verwijderde accounts`;
        case AuditLogType.MemberResponsibilityRecordAdded:
            return `Nieuwe toegekende functies`;
        case AuditLogType.MemberResponsibilityRecordEdited:
            return `Wijzigingen aan toegekende functies`;
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return `Verwijderde functies`;

        case AuditLogType.MemberPlatformMembershipAdded:
            return `Nieuwe aansluitingen`;
        case AuditLogType.MemberPlatformMembershipEdited:
            return `Wijzigingen aan aansluitingen`;
        case AuditLogType.MemberPlatformMembershipDeleted:
            return `Verwijderde aansluitingen`;
    }

    return type;
}

export function getAuditLogTypeIcon(type: AuditLogType): [icon: string, subIcon?: string] {
    switch (type) {
        case AuditLogType.MemberEdited:
            return [`user`, `edit`];
        case AuditLogType.MemberAdded:
            return [`user`, 'add green'];
        case AuditLogType.MemberDeleted:
            return [`user`, `canceled red`];
        case AuditLogType.MemberRegistered:
            return [`membership-filled`, `success`];
        case AuditLogType.MemberUnregistered:
            return [`membership-filled`, `canceled red`];
        case AuditLogType.PlatformSettingsChanged:
            return [`flag`, `settings`];

        case AuditLogType.OrganizationEdited:
            return [`flag`];
        case AuditLogType.OrganizationAdded:
            return [`flag`, `add green`];
        case AuditLogType.OrganizationDeleted:
            return [`flag`, `canceled red`];

        case AuditLogType.Unknown:
            return [`help`];

        case AuditLogType.EventEdited:
            return [`calendar`, `edit`];
        case AuditLogType.EventAdded:
            return [`calendar`, `add green`];
        case AuditLogType.EventDeleted:
            return [`calendar`, `canceled red`];

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

        case AuditLogType.WebshopEdited:
            return [`basket`, `edit`];
        case AuditLogType.WebshopAdded:
            return [`basket`, `add green`];
        case AuditLogType.WebshopDeleted:
            return [`basket`, `canceled red`];
        case AuditLogType.OrderAdded:
            return [`basket`, `add green`];
        case AuditLogType.OrderEdited:
            return [`basket`, `edit`];
        case AuditLogType.OrderDeleted:
            return [`basket`, `canceled red`];

        case AuditLogType.PaymentAdded:
            return [`card`, `add green`];
        case AuditLogType.PaymentEdited:
            return [`card`, `edit`];
        case AuditLogType.PaymentDeleted:
            return [`card`, `canceled red`];

        case AuditLogType.DocumentTemplateAdded:
            return [`file`, `add green`];
        case AuditLogType.DocumentTemplateEdited:
            return [`file`, `edit`];
        case AuditLogType.DocumentTemplateDeleted:
            return [`file`, `canceled red`];

        case AuditLogType.UserAdded:
            return [`user`, `add green`];
        case AuditLogType.UserEdited:
            return [`user`, `edit`];
        case AuditLogType.UserDeleted:
            return [`user`, `canceled red`];

        case AuditLogType.MemberResponsibilityRecordAdded:
            return [`star`, `add green`];
        case AuditLogType.MemberResponsibilityRecordEdited:
            return [`star`, `edit`];
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return [`star`, `canceled red`];

        case AuditLogType.MemberPlatformMembershipAdded:
            return [`membership-filled`, `add green`];
        case AuditLogType.MemberPlatformMembershipEdited:
            return [`membership-filled`, `edit`];
        case AuditLogType.MemberPlatformMembershipDeleted:
            return [`membership-filled`, `canceled red`];
    }
    return [`help`];
}

function getAuditLogTypeTitleTemplate(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberAdded:
            return `{{m}} werd aangemaakt`;
        case AuditLogType.MemberDeleted:
            return `{{m}} werd verwijderd`;
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

        case AuditLogType.OrganizationEdited:
            return `{{if org 'De instellingen van ' org ' werden gewijzigd'}}{{unless org 'De instellingen werden gewijzigd'}}`;

        case AuditLogType.OrganizationAdded:
            return `De lokale groep {{org}} werd aangemaakt`;

        case AuditLogType.OrganizationDeleted:
            return `De lokale groep {{org}} werd verwijderd`;

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

        case AuditLogType.WebshopEdited:
            return `De webshop {{w}} werd gewijzigd`;
        case AuditLogType.WebshopAdded:
            return `De webshop {{w}} werd aangemaakt`;
        case AuditLogType.WebshopDeleted:
            return `De webshop {{w}} werd verwijderd`;

        case AuditLogType.OrderAdded:
            return `{{capitalizeFirstLetter o}} werd geplaatst (voor {{w}})`;
        case AuditLogType.OrderEdited:
            return `{{capitalizeFirstLetter o}} werd gewijzigd ({{w}})`;
        case AuditLogType.OrderDeleted:
            return `{{capitalizeFirstLetter o}} werd verwijderd ({{w}})`;

        case AuditLogType.PaymentAdded:
            return `{{capitalizeFirstLetter p}} werd aangemaakt`;
        case AuditLogType.PaymentEdited:
            return `{{capitalizeFirstLetter p}} werd gewijzigd`;
        case AuditLogType.PaymentDeleted:
            return `{{capitalizeFirstLetter p}} werd verwijderd`;

        case AuditLogType.DocumentTemplateAdded:
            return `Document {{d}} werd aangemaakt`;
        case AuditLogType.DocumentTemplateEdited:
            return `Document {{d}} werd gewijzigd`;
        case AuditLogType.DocumentTemplateDeleted:
            return `Document {{d}} werd verwijderd`;

        case AuditLogType.UserAdded:
            return `Account {{u}} werd aangemaakt`;
        case AuditLogType.UserEdited:
            return `Account {{u}} werd gewijzigd`;
        case AuditLogType.UserDeleted:
            return `Account {{u}} werd verwijderd`;

        case AuditLogType.MemberResponsibilityRecordAdded:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd toegekend aan {{m}}`;
        case AuditLogType.MemberResponsibilityRecordEdited:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd gewijzigd bij {{m}}`;
        case AuditLogType.MemberResponsibilityRecordDeleted:
            return `Functie {{r}}{{if g " van " g}}{{if org " (" org ")"}} werd verwijderd van {{m}}`;

        case AuditLogType.MemberPlatformMembershipAdded:
            return `Aansluiting {{pm}} werd toegevoegd bij {{m}}{{if org " via " org}}`;
        case AuditLogType.MemberPlatformMembershipEdited:
            return `Aansluiting {{pm}} werd gewijzigd bij {{m}}{{if org " via " org}}`;
        case AuditLogType.MemberPlatformMembershipDeleted:
            return `Aansluiting {{pm}} werd verwijderd bij {{m}}{{if org " via " org}}`;
    }
}

function getTypeReplacements(type: AuditLogType): string[] {
    switch (type) {
        case AuditLogType.MemberAdded:
        case AuditLogType.MemberEdited:
        case AuditLogType.MemberDeleted:
            return ['m'];
        case AuditLogType.MemberRegistered:
        case AuditLogType.MemberUnregistered:
            return ['m', 'g'];
        case AuditLogType.OrganizationEdited:
        case AuditLogType.OrganizationAdded:
        case AuditLogType.OrganizationDeleted:
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

        case AuditLogType.WebshopEdited:
        case AuditLogType.WebshopAdded:
        case AuditLogType.WebshopDeleted:
            return ['w'];

        case AuditLogType.OrderAdded:
        case AuditLogType.OrderEdited:
        case AuditLogType.OrderDeleted:
            return ['o', 'w'];
        default:
            return [];
    }
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
        if (this.type === AuditLogReplacementType.Uuid || (this.id && !this.value && isUuid(this.id))) {
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

    toKey(): string {
        if (this.type === AuditLogReplacementType.Array) {
            return this.values.map(v => v.toKey()).filter(v => !!v).join('.');
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
         Platform.shared.config.membershipTypes,
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
const enumHelpers: ((key: string) => string)[] = [
    PaymentMethodHelper.getPluralName,
    ParentTypeHelper.getName,
    OrderStatusHelper.getName,
    DocumentStatusHelper.getName,
    AccessRightHelper.getName,
    CheckoutMethodTypeHelper.getName,
    CountryHelper.getName,
    OrganizationTypeHelper.getName.bind(OrganizationTypeHelper),
    PaymentStatusHelper.getName.bind(PaymentStatusHelper),
    UmbrellaOrganizationHelper.getName.bind(UmbrellaOrganizationHelper),
    STPackageTypeHelper.getName.bind(STPackageTypeHelper),
    ParentTypeHelper.getName.bind(ParentTypeHelper),
    getGroupStatusName,
    getGenderName,
    getSetupStepName,
];

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
        for (const helper of enumHelpers) {
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

    @field({ decoder: new EnumDecoder(AuditLogSource), ...NextVersion })
    source: AuditLogSource;

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
                    capitalizeFirstLetter: (context: RenderContext, object: any) => {
                        if (object instanceof AuditLogReplacement) {
                            const clone = object.clone();
                            clone.value = Formatter.capitalizeFirstLetter(clone.value);
                            return [clone];
                        }
                        return [object];
                    },
                    if: (context: RenderContext, object: any, ...prefixes) => {
                        if (object) {
                            return [...prefixes];
                        }
                        return [];
                    },
                    unless: (context: RenderContext, object: any, ...prefixes) => {
                        if (!object) {
                            return [...prefixes];
                        }
                        return [];
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
