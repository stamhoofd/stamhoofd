import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { NamedObject } from './Event.js';
import { Formatter } from '@stamhoofd/utility';
import { RenderContext, renderTemplate } from './AuditLogRenderer.js';

export enum AuditLogType {
    /**
     * Used for legacy logs
     */
    Unknown = 'Unknown',
    MemberEdited = 'MemberEdited',
    MemberAdded = 'MemberAdded',
    MemberRegistered = 'MemberRegistered',
    MemberUnregistered = 'MemberUnregistered',
    PlatformSettingChanged = 'PlatformSettingChanged',

}

export enum AuditLogReplacementType {
    Member = 'Member',
    Group = 'Group',
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
        case AuditLogType.PlatformSettingChanged:
            return `Wijzigingen aan platforminstellingen`;
    }
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
        case AuditLogType.PlatformSettingChanged:
            return [`home`, `edit`];
        case AuditLogType.Unknown:
            return [`help`];
    }
    return [`help`];
}

function getAuditLogTypeTitleTemplate(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberAdded:
            return `{{m}} werd aangemaakt`;
        case AuditLogType.MemberEdited:
            return `De gegevens van {{m}} werden gewijzgd`;
        case AuditLogType.MemberRegistered:
            return `{{m}} werd ingeschreven voor {{g}}`;
        case AuditLogType.MemberUnregistered:
            return `{{m}} werd uitgeschreven voor {{g}}`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
        case AuditLogType.PlatformSettingChanged:
            return `{{o}} {{plural o "werd" "werden"}} aangepast`;
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
        case AuditLogType.Unknown:
            return [];
        default:
            return [];
    }
}

export class AuditLogReplacement extends AutoEncoder {
    @field({ field: 'v', decoder: StringDecoder })
    value: string;

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

    toString() {
        return this.value;
    }
}

export function getAuditLogPatchKeyName(key: string) {
    switch (key) {
        case 'parent':
            return `Ouder`;
        case 'address':
            return `Adres`;
        case 'address.street':
            return `Straat`;
        case 'address.number':
            return `Huisnummer`;
        case 'address.postalCode':
            return `Postcode`;
        case 'address.city':
            return `Gemeente`;
        case 'address.country':
            return `Land`;
        case 'email':
            return `E-mailadres`;
        case 'phone':
            return `GSM-nummer`;
        case 'firstName':
            return `Voornaam`;
        case 'lastName':
            return `Achternaam`;
        case 'nationalRegisterNumber':
            return `Rijkregisternummer`;
        case 'birthDay':
            return `Geboortedatum`;
        case 'dataPermissions':
            return `Toestemming gegevensverwerking`;
        case `notes`:
            return `Notities`;
        case 'alternativeEmails':
            return `Alternatieve e-mailadressen`;
        case 'name':
            return `Naam`;
        case 'description':
            return `Beschrijving`;
        case 'isLocationRequired':
            return `Locatie verplicht`;
        case '_order':
            return `Volgorde`;
        case 'membershipType':
            return `Aansluitingstype`;
        case 'period':
            return `Werkjaar`;
        case 'responsibility':
            return `Functie`;
    }
    return Formatter.capitalizeFirstLetter(key);
}

export class AuditLogPatchItem extends AutoEncoder {
    /**
     * E.g. 'parent'
     * E.g. 'address'
     */
    @field({ field: 'k', decoder: StringDecoder })
    key: string;

    /**
     * (key of who?) to explain deeper relational changes
     * E.g. address (=key) of a parent: 'Simon (parent)' (=name)
     */
    @field({ field: 'n', decoder: StringDecoder, optional: true })
    name?: string;

    @field({ field: 'o', decoder: StringDecoder, optional: true })
    oldValue?: string;

    @field({ field: 'v', decoder: StringDecoder, optional: true })
    value?: string;
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
