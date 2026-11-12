import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, NumberDecoder } from '@common/encoding';
import { SimpleError, SimpleErrors } from '@common/errors';

export enum DataRetentionCategory {
    Members = 'Members',
    SensitiveData = 'SensitiveData',
    Documents = 'Documents',
    /**
     * Within a platform, only the term of the platform applies because accounts are shared between organizations.
     */
    Accounts = 'Accounts',
    Orders = 'Orders',
    Emails = 'Emails',
    AuditLogs = 'AuditLogs',
}

const CATEGORY_CAPABILITIES: Record<DataRetentionCategory, { anonymize: boolean; delete: boolean; protectedPeriods: boolean }> = {
    [DataRetentionCategory.Members]: { anonymize: true, delete: true, protectedPeriods: true },
    [DataRetentionCategory.SensitiveData]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.Documents]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.Accounts]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.Orders]: { anonymize: true, delete: false, protectedPeriods: false },
    [DataRetentionCategory.Emails]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.AuditLogs]: { anonymize: false, delete: true, protectedPeriods: false },
};

export const DATA_RETENTION_MINIMUM_MONTHS = 3;
export const DATA_RETENTION_MAXIMUM_MONTHS = 20 * 12;
export const DATA_RETENTION_MINIMUM_PROTECTED_PERIODS = 1;
export const DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS = 20;
export const DATA_RETENTION_DEFAULT_PROTECTED_PERIODS = 2;
export const DATA_RETENTION_WAITING_DAYS = 30;

export function getDataRetentionCategoryName(category: DataRetentionCategory): string {
    switch (category) {
        case DataRetentionCategory.Members:
            return $t('Leden');
        case DataRetentionCategory.SensitiveData:
            return $t('Gevoelige gegevens');
        case DataRetentionCategory.Documents:
            return $t('Documenten');
        case DataRetentionCategory.Accounts:
            return $t('Accounts');
        case DataRetentionCategory.Orders:
            return $t('Bestellingen');
        case DataRetentionCategory.Emails:
            return $t('E-mails');
        case DataRetentionCategory.AuditLogs:
            return $t('Logboek');
    }
}

export function isDataRetentionCategory(value: string): value is DataRetentionCategory {
    return (Object.values(DataRetentionCategory) as string[]).includes(value);
}

/**
 * Within a platform, an organization cannot set a term for accounts: they are shared between organizations.
 */
export function getDataRetentionCategories({ isOrganizationWithinPlatform }: { isOrganizationWithinPlatform: boolean }): DataRetentionCategory[] {
    const categories = Object.values(DataRetentionCategory);
    if (isOrganizationWithinPlatform) {
        return categories.filter(category => category !== DataRetentionCategory.Accounts);
    }
    return categories;
}

/**
 * Uses NumberDecoder instead of IntegerDecoder because IntegerDecoder reads a string such as '3abc' as 3.
 * validate() rejects everything that is not a whole number within the allowed range.
 */
export class DataRetentionTerms extends AutoEncoder {
    @field({ decoder: NumberDecoder, nullable: true })
    anonymizeAfterMonths: number | null = null;

    @field({ decoder: NumberDecoder, nullable: true })
    deleteAfterMonths: number | null = null;

    /**
     * Members with a registration or membership in this many periods, including the current one, are not anonymized or deleted.
     */
    @field({ decoder: NumberDecoder, nullable: true })
    protectedPeriods: number | null = null;

    /**
     * Only compares the values of this level. A conflict with another level is never an error.
     */
    validate(category: DataRetentionCategory) {
        const capabilities = CATEGORY_CAPABILITIES[category];
        const errors = new SimpleErrors();

        if (this.anonymizeAfterMonths !== null && !capabilities.anonymize) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'anonymizeAfterMonths',
                message: 'This category cannot be anonymized',
                human: $t('Deze gegevens kunnen niet geanonimiseerd worden.'),
            }));
        }

        if (this.deleteAfterMonths !== null && !capabilities.delete) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'deleteAfterMonths',
                message: 'This category cannot be deleted',
                human: $t('Deze gegevens kunnen niet verwijderd worden.'),
            }));
        }

        if (this.protectedPeriods !== null && !capabilities.protectedPeriods) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'protectedPeriods',
                message: 'This category does not support protected periods',
                human: $t('Bij deze gegevens kan je geen werkjaren beschermen.'),
            }));
        }

        for (const fieldName of ['anonymizeAfterMonths', 'deleteAfterMonths'] as const) {
            const value = this[fieldName];
            if (value !== null && !isIntegerInRange(value, DATA_RETENTION_MINIMUM_MONTHS, DATA_RETENTION_MAXIMUM_MONTHS)) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: fieldName,
                    message: `Expected a whole number of months between ${DATA_RETENTION_MINIMUM_MONTHS} and ${DATA_RETENTION_MAXIMUM_MONTHS}`,
                    human: $t('Een termijn moet een geheel aantal maanden zijn, met een minimum van {minimum} maanden en een maximum van {maximum} jaar.', {
                        minimum: DATA_RETENTION_MINIMUM_MONTHS,
                        maximum: DATA_RETENTION_MAXIMUM_MONTHS / 12,
                    }),
                }));
            }
        }

        if (this.protectedPeriods !== null && !isIntegerInRange(this.protectedPeriods, DATA_RETENTION_MINIMUM_PROTECTED_PERIODS, DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS)) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'protectedPeriods',
                message: `Expected a whole number of periods between ${DATA_RETENTION_MINIMUM_PROTECTED_PERIODS} and ${DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS}`,
                human: $t('Het aantal werkjaren moet een geheel getal zijn, met een minimum van {minimum} en een maximum van {maximum}.', {
                    minimum: DATA_RETENTION_MINIMUM_PROTECTED_PERIODS,
                    maximum: DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS,
                }),
            }));
        }

        if (this.anonymizeAfterMonths !== null && this.deleteAfterMonths !== null && this.deleteAfterMonths < this.anonymizeAfterMonths) {
            errors.addError(new SimpleError({
                code: 'invalid_field',
                field: 'deleteAfterMonths',
                message: 'The term to delete cannot be shorter than the term to anonymize',
                human: $t('De termijn om te verwijderen mag niet korter zijn dan de termijn om te anonimiseren.'),
            }));
        }

        errors.throwIfNotEmpty();
    }

    isSameAs(other: DataRetentionTerms): boolean {
        return this.anonymizeAfterMonths === other.anonymizeAfterMonths
            && this.deleteAfterMonths === other.deleteAfterMonths
            && this.protectedPeriods === other.protectedPeriods;
    }

    /**
     * Used in audit logs, so it describes the values as they were saved.
     */
    getDescription(): string {
        const parts: string[] = [];
        if (this.anonymizeAfterMonths !== null) {
            parts.push($t('anonimiseren na {months} maanden', { months: this.anonymizeAfterMonths }));
        }
        if (this.deleteAfterMonths !== null) {
            parts.push($t('verwijderen na {months} maanden', { months: this.deleteAfterMonths }));
        }
        if (this.protectedPeriods !== null) {
            parts.push($t('laatste {periods} werkjaren beschermd', { periods: this.protectedPeriods }));
        }
        return parts.length > 0 ? parts.join(', ') : $t('geen termijn');
    }
}

export class DataRetentionPolicy extends AutoEncoder {
    @field({ decoder: new EnumDecoder(DataRetentionCategory) })
    category: DataRetentionCategory;

    @field({ decoder: DataRetentionTerms })
    terms = DataRetentionTerms.create({});

    @field({ decoder: DataRetentionTerms, nullable: true })
    pendingTerms: DataRetentionTerms | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    pendingFrom: Date | null = null;

    /**
     * Pending terms apply from pendingFrom onwards, also before the cron has moved them to the current terms.
     */
    getActiveTerms(now: Date): DataRetentionTerms {
        if (this.pendingTerms && this.pendingFrom && this.pendingFrom <= now) {
            return this.pendingTerms;
        }
        return this.terms;
    }

    /**
     * The policy of a level without saved settings. Only the top level protects periods by default:
     * an organization within a platform follows the platform until it fills in its own value.
     */
    static createDefault(category: DataRetentionCategory, { isTopLevel }: { isTopLevel: boolean }): DataRetentionPolicy {
        return DataRetentionPolicy.create({
            category,
            terms: DataRetentionTerms.create({
                protectedPeriods: isTopLevel && CATEGORY_CAPABILITIES[category].protectedPeriods ? DATA_RETENTION_DEFAULT_PROTECTED_PERIODS : null,
            }),
        });
    }
}

/**
 * What an administrator can see and change. The frontend combines both levels with resolveDataRetentionTerms.
 */
export class DataRetentionSettings extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(DataRetentionPolicy) })
    policies: DataRetentionPolicy[] = [];

    /**
     * Only for an organization within a platform.
     */
    @field({ decoder: new ArrayDecoder(DataRetentionPolicy) })
    platformPolicies: DataRetentionPolicy[] = [];
}

/**
 * Replaces all terms of one category, for the level of the request.
 */
export class DataRetentionPolicyUpdate extends AutoEncoder {
    @field({ decoder: new EnumDecoder(DataRetentionCategory) })
    category: DataRetentionCategory;

    @field({ decoder: DataRetentionTerms })
    terms: DataRetentionTerms;
}

export type ResolvedDataRetentionTerms = {
    anonymizeAfterMonths: number | null;
    deleteAfterMonths: number | null;
    protectedPeriods: number | null;
    /**
     * The levels combined would delete before anonymizing, so the delete term was extended.
     * Used to warn an organization about the conflict.
     */
    deleteExtendedByAnonymize: boolean;
};

/**
 * The longest term of both levels applies, separately for each action.
 */
export function resolveDataRetentionTerms(platform: DataRetentionPolicy | null, organization: DataRetentionPolicy | null, now: Date): ResolvedDataRetentionTerms {
    const platformTerms = platform?.getActiveTerms(now) ?? null;
    const organizationTerms = organization?.getActiveTerms(now) ?? null;

    const anonymizeAfterMonths = getLongest(platformTerms?.anonymizeAfterMonths, organizationTerms?.anonymizeAfterMonths);
    const deleteAfterMonths = getLongest(platformTerms?.deleteAfterMonths, organizationTerms?.deleteAfterMonths);
    const deleteExtendedByAnonymize = anonymizeAfterMonths !== null && deleteAfterMonths !== null && deleteAfterMonths < anonymizeAfterMonths;

    return {
        anonymizeAfterMonths,
        deleteAfterMonths: deleteExtendedByAnonymize ? anonymizeAfterMonths : deleteAfterMonths,
        protectedPeriods: getLongest(platformTerms?.protectedPeriods, organizationTerms?.protectedPeriods),
        deleteExtendedByAnonymize,
    };
}

type ComparableDataRetentionTerms = Pick<DataRetentionTerms, 'anonymizeAfterMonths' | 'deleteAfterMonths' | 'protectedPeriods'>;

/**
 * Whether a change can erase data sooner, which means it has to wait before it applies.
 *
 * An organization compares its resolved terms. A platform compares its own terms with removedTermIsEarlier,
 * because removing a platform term can make the shorter term of an organization apply.
 */
export function isEarlierDataRetentionDeletion(before: ComparableDataRetentionTerms, after: ComparableDataRetentionTerms, { removedTermIsEarlier = false }: { removedTermIsEarlier?: boolean } = {}): boolean {
    return isEarlierTerm(before.anonymizeAfterMonths, after.anonymizeAfterMonths, removedTermIsEarlier)
        || isEarlierTerm(before.deleteAfterMonths, after.deleteAfterMonths, removedTermIsEarlier)
        || (before.protectedPeriods !== null && (after.protectedPeriods === null || after.protectedPeriods < before.protectedPeriods));
}

function isEarlierTerm(before: number | null, after: number | null, removedTermIsEarlier: boolean): boolean {
    if (after === null) {
        return removedTermIsEarlier && before !== null;
    }
    return before === null || after < before;
}

function getLongest(a: number | null | undefined, b: number | null | undefined): number | null {
    if (a === null || a === undefined) {
        return b ?? null;
    }
    if (b === null || b === undefined) {
        return a;
    }
    return Math.max(a, b);
}

function isIntegerInRange(value: number, minimum: number, maximum: number): boolean {
    return Number.isInteger(value) && value >= minimum && value <= maximum;
}
