import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { RenderContext, renderTemplate } from './AuditLogRenderer.js';
import { NamedObject } from './Event.js';

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
            return [`clock`, `edit`];
        case AuditLogType.WaitingListAdded:
            return [`clock`, `add green`];
        case AuditLogType.WaitingListDeleted:
            return [`clock`, `canceled red`];
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
            if (this.values.every(t => t.type === AuditLogReplacementType.Key)) {
                return [AuditLogReplacement.key(this.values.map(v => v.value).join('.'))];
            }
            return this.values;
        }
        return [this];
    }

    prepend(add: AuditLogReplacement) {
        return AuditLogReplacement.array([add, this]);
    }

    append(add: AuditLogReplacement) {
        return AuditLogReplacement.array([this, add]);
    }

    static array(values: AuditLogReplacement[]) {
        return AuditLogReplacement.create({ values: values.flatMap(v => v.flatten()), type: AuditLogReplacementType.Array });
    }

    static key(str: string) {
        return AuditLogReplacement.create({ value: str, type: AuditLogReplacementType.Key });
    }

    static string(str: string) {
        return AuditLogReplacement.create({ value: str });
    }

    toString() {
        if (this.type === AuditLogReplacementType.Key) {
            return getAuditLogPatchKeyName(this.value);
        }
        return this.value;
    }
}

export function getAuditLogPatchKeyName(key: string) {
    switch (key) {
        case 'parent':
            return `ouder`;
        case 'address':
            return `adres`;
        case 'address.street':
            return `straat`;
        case 'address.number':
            return `huisnummer`;
        case 'address.postalCode':
            return `postcode`;
        case 'address.city':
            return `gemeente`;
        case 'address.country':
            return `land`;
        case 'email':
            return `e-mailadres`;
        case 'phone':
            return `GSM-nummer`;
        case 'firstName':
            return `voornaam`;
        case 'lastName':
            return `achternaam`;
        case 'nationalRegisterNumber':
            return `rijkregisternummer`;
        case 'birthDay':
            return `geboortedatum`;
        case 'dataPermissions':
            return `toestemming gegevensverwerking`;
        case `notes`:
            return `Notities`;
        case 'alternativeEmails':
            return `alternatieve e-mailadressen`;
        case 'name':
            return `naam`;
        case 'description':
            return `beschrijving`;
        case 'isLocationRequired':
            return `locatie verplicht`;
        case '_order':
            return `volgorde`;
        case 'membershipType':
            return `aansluitingstype`;
        case 'membershipTypes':
            return `aansluitingen en verzekeringen`;
        case 'period':
            return `werkjaar`;
        case 'responsibility':
            return `functie`;
        case 'recordsConfiguration':
            return `persoonsgegevens`;
        case 'defaultAgeGroups':
            return `standaard leeftijdsgroepen`;
        case 'defaultAgeGroup':
            return `standaard leeftijdsgroep`;
        case 'eventTypes':
            return `soorten activiteiten`;
        case 'eventType':
            return `soort activiteit`;
        case 'horizontalLogo':
            return `horizontaal logo`;
        case 'squareLogo':
            return `vierkant logo`;
        case 'logoDocuments':
            return `logo op documenten`;
        case 'color':
            return `huisstijlkleur`;
        case 'price':
            return `prijs`;
        case 'price.price':
            return `prijs`;
        case 'price.reducedPrice':
            return `verlaagd tarief`;
        case 'prices':
            return `prijzen`;
        case 'responsibilities':
            return `functies`;
        case 'minimumMembers':
            return `minimum aantal`;
    }

    if (key.includes('.')) {
        const splitted = key.split('.');
        const firstWord = splitted[0];
        const remaining = splitted.slice(1).join('.');

        return `${getAuditLogPatchKeyName(firstWord)} ${getAuditLogPatchKeyName(remaining)}`;
    }
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
        else if (!this.value) {
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
