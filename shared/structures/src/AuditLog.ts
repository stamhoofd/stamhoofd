import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { NamedObject } from './Event';

export enum AuditLogType {
    /**
     * Used for legacy logs
     */
    Unknown = 'Unknown',
    MemberEdited = 'MemberEdited',
    MemberRegistered = 'MemberRegistered',
}

export enum AuditLogReplacementType {
    Member = 'Member',
    Group = 'Group',
}

export function getAuditLogTypeName(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberEdited:
            return `Lid gewijzigd`;
        case AuditLogType.MemberRegistered:
            return `Nieuwe inschrijving`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
    }
}

export function getAuditLogTypeIcon(type: AuditLogType): [icon: string, subIcon?: string] {
    switch (type) {
        case AuditLogType.MemberEdited:
            return [`user`, `edit`];
        case AuditLogType.MemberRegistered:
            return [`membership-filled`, `success`];
        case AuditLogType.Unknown:
            return [`help`];
    }
}

function getAuditLogTypeTitleTemplate(type: AuditLogType): string {
    switch (type) {
        case AuditLogType.MemberEdited:
            return `De gegevens van {{m}} werden gewijzgd`;
        case AuditLogType.MemberRegistered:
            return `{{m}} werd ingeschreven voor {{g}}`;
        case AuditLogType.Unknown:
            return `Onbekende actie`;
    }
}

function getTypeReplacements(type: AuditLogType): string[] {
    switch (type) {
        case AuditLogType.MemberEdited:
            return ['m'];
        case AuditLogType.MemberRegistered:
            return ['m', 'g'];
        case AuditLogType.Unknown:
            return [];
    }
}

function renderTemplate(template: string, replacements: Map<string, AuditLogReplacement>) {
    for (const [key, value] of replacements.entries()) {
        template = template.replace(new RegExp(`{{${key}}}`, 'g'), value.value);
    }
    return template;
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

    get title() {
        return renderTemplate(getAuditLogTypeTitleTemplate(this.type), this.replacements);
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
