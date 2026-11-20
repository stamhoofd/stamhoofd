import {
    ArrayDecoder,
    AutoEncoder,
    BooleanDecoder,
    DateDecoder,
    EnumDecoder,
    field,
    MapDecoder,
    NumberDecoder,
    StringDecoder,
} from '@common/encoding';
import { SimpleError, SimpleErrors } from '@common/errors';
import { Formatter } from '@stamhoofd/utility';

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

const CATEGORY_CAPABILITIES: Record<
    DataRetentionCategory,
    { anonymize: boolean; delete: boolean; protectedPeriods: boolean }
> = {
    [DataRetentionCategory.Members]: { anonymize: true, delete: true, protectedPeriods: true },
    [DataRetentionCategory.SensitiveData]: {
        anonymize: false,
        delete: true,
        protectedPeriods: false,
    },
    [DataRetentionCategory.Documents]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.Accounts]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.Orders]: { anonymize: true, delete: false, protectedPeriods: false },
    [DataRetentionCategory.Emails]: { anonymize: false, delete: true, protectedPeriods: false },
    [DataRetentionCategory.AuditLogs]: { anonymize: false, delete: true, protectedPeriods: false },
};

export enum DataRetentionAction {
    Anonymize = 'Anonymize',
    Delete = 'Delete',
    RemoveSensitiveData = 'RemoveSensitiveData',
}

/**
 * Why data is kept after its term has passed. It is processed once the reason is gone.
 */
export enum DataRetentionHoldReason {
    ActiveResponsibility = 'ActiveResponsibility',
    ActiveMembership = 'ActiveMembership',
    AdminAccount = 'AdminAccount',
    OpenBalance = 'OpenBalance',
    ProtectedPeriod = 'ProtectedPeriod',
    UnchargedMembership = 'UnchargedMembership',
}

export const DATA_RETENTION_MINIMUM_MONTHS = 3;
export const DATA_RETENTION_MAXIMUM_MONTHS = 20 * 12;
export const DATA_RETENTION_MINIMUM_PROTECTED_PERIODS = 1;
export const DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS = 20;
export const DATA_RETENTION_DEFAULT_PROTECTED_PERIODS = 2;
export const DATA_RETENTION_WAITING_DAYS = 30;

/**
 * The term of an account starts at its last activity, but never before this date: users.lastActiveAt only exists since
 * 30 July 2026, so an older or missing value says nothing. Move this to the launch date of data retention before it goes live.
 */
export const DATA_RETENTION_LAUNCH_DATE = new Date('2026-07-30T00:00:00+02:00');

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

/**
 * Which settings a category supports. An action that is not possible is shown as unavailable, with the reason.
 */
export function getDataRetentionCapabilities(category: DataRetentionCategory): {
    anonymize: boolean;
    delete: boolean;
    protectedPeriods: boolean;
} {
    return CATEGORY_CAPABILITIES[category];
}

export function isDataRetentionCategory(value: string): value is DataRetentionCategory {
    return (Object.values(DataRetentionCategory) as string[]).includes(value);
}

/**
 * Within a platform, an organization cannot set a term for accounts: they are shared between organizations.
 */
export function getDataRetentionCategories({
    isOrganizationWithinPlatform,
}: {
    isOrganizationWithinPlatform: boolean;
}): DataRetentionCategory[] {
    const categories = Object.values(DataRetentionCategory);
    if (isOrganizationWithinPlatform) {
        return categories.filter((category) => category !== DataRetentionCategory.Accounts);
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
            errors.addError(
                new SimpleError({
                    code: 'invalid_field',
                    field: 'anonymizeAfterMonths',
                    message: 'This category cannot be anonymized',
                    human: $t('Deze gegevens kunnen niet geanonimiseerd worden.'),
                }),
            );
        }

        if (this.deleteAfterMonths !== null && !capabilities.delete) {
            errors.addError(
                new SimpleError({
                    code: 'invalid_field',
                    field: 'deleteAfterMonths',
                    message: 'This category cannot be deleted',
                    human: $t('Deze gegevens kunnen niet verwijderd worden.'),
                }),
            );
        }

        if (this.protectedPeriods !== null && !capabilities.protectedPeriods) {
            errors.addError(
                new SimpleError({
                    code: 'invalid_field',
                    field: 'protectedPeriods',
                    message: 'This category does not support protected periods',
                    human: $t('Bij deze gegevens kan je geen werkjaren beschermen.'),
                }),
            );
        }

        for (const fieldName of ['anonymizeAfterMonths', 'deleteAfterMonths'] as const) {
            const value = this[fieldName];
            if (
                value !== null &&
                !isIntegerInRange(
                    value,
                    DATA_RETENTION_MINIMUM_MONTHS,
                    DATA_RETENTION_MAXIMUM_MONTHS,
                )
            ) {
                errors.addError(
                    new SimpleError({
                        code: 'invalid_field',
                        field: fieldName,
                        message: `Expected a whole number of months between ${DATA_RETENTION_MINIMUM_MONTHS} and ${DATA_RETENTION_MAXIMUM_MONTHS}`,
                        human: $t(
                            'Een termijn moet een geheel aantal maanden zijn, met een minimum van {minimum} maanden en een maximum van {maximum} jaar.',
                            {
                                minimum: DATA_RETENTION_MINIMUM_MONTHS,
                                maximum: DATA_RETENTION_MAXIMUM_MONTHS / 12,
                            },
                        ),
                    }),
                );
            }
        }

        if (
            this.protectedPeriods !== null &&
            !isIntegerInRange(
                this.protectedPeriods,
                DATA_RETENTION_MINIMUM_PROTECTED_PERIODS,
                DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS,
            )
        ) {
            errors.addError(
                new SimpleError({
                    code: 'invalid_field',
                    field: 'protectedPeriods',
                    message: `Expected a whole number of periods between ${DATA_RETENTION_MINIMUM_PROTECTED_PERIODS} and ${DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS}`,
                    human: $t(
                        'Het aantal werkjaren moet een geheel getal zijn, met een minimum van {minimum} en een maximum van {maximum}.',
                        {
                            minimum: DATA_RETENTION_MINIMUM_PROTECTED_PERIODS,
                            maximum: DATA_RETENTION_MAXIMUM_PROTECTED_PERIODS,
                        },
                    ),
                }),
            );
        }

        if (
            this.anonymizeAfterMonths !== null &&
            this.deleteAfterMonths !== null &&
            this.deleteAfterMonths < this.anonymizeAfterMonths
        ) {
            errors.addError(
                new SimpleError({
                    code: 'invalid_field',
                    field: 'deleteAfterMonths',
                    message: 'The term to delete cannot be shorter than the term to anonymize',
                    human: $t(
                        'De termijn om te verwijderen mag niet korter zijn dan de termijn om te anonimiseren.',
                    ),
                }),
            );
        }

        errors.throwIfNotEmpty();
    }

    isSameAs(other: DataRetentionTerms): boolean {
        return (
            this.anonymizeAfterMonths === other.anonymizeAfterMonths &&
            this.deleteAfterMonths === other.deleteAfterMonths &&
            this.protectedPeriods === other.protectedPeriods
        );
    }

    /**
     * Used in audit logs, so it describes the values as they were saved.
     */
    getDescription(): string {
        const parts: string[] = [];
        if (this.anonymizeAfterMonths !== null) {
            parts.push(
                $t('anonimiseren na {months} maanden', { months: this.anonymizeAfterMonths }),
            );
        }
        if (this.deleteAfterMonths !== null) {
            parts.push($t('verwijderen na {months} maanden', { months: this.deleteAfterMonths }));
        }
        if (this.protectedPeriods !== null) {
            parts.push(
                $t('laatste {periods} werkjaren beschermd', { periods: this.protectedPeriods }),
            );
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
    static createDefault(
        category: DataRetentionCategory,
        { isTopLevel }: { isTopLevel: boolean },
    ): DataRetentionPolicy {
        return DataRetentionPolicy.create({
            category,
            terms: DataRetentionTerms.create({
                protectedPeriods:
                    isTopLevel && CATEGORY_CAPABILITIES[category].protectedPeriods
                        ? DATA_RETENTION_DEFAULT_PROTECTED_PERIODS
                        : null,
            }),
        });
    }
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

/**
 * How many items of one category are processed by one action.
 */
export class DataRetentionCount extends AutoEncoder {
    @field({ decoder: new EnumDecoder(DataRetentionCategory) })
    category: DataRetentionCategory;

    @field({ decoder: new EnumDecoder(DataRetentionAction) })
    action: DataRetentionAction;

    /**
     * The term has passed and nothing holds it, so the next run processes it.
     */
    @field({ decoder: NumberDecoder })
    due = 0;

    /**
     * The term has passed, but it is kept for now.
     */
    @field({ decoder: NumberDecoder })
    held = 0;

    /**
     * Per reason. One item can be held for several reasons, so the sum can be higher than held.
     */
    @field({ decoder: new MapDecoder(new EnumDecoder(DataRetentionHoldReason), NumberDecoder) })
    heldBy = new Map<DataRetentionHoldReason, number>();

    /**
     * Per month (yyyy-mm, Belgian time) in which the term passes, for the current month and the 12 months after it. Later terms are counted under 'later'.
     */
    @field({ decoder: new MapDecoder(StringDecoder, NumberDecoder) })
    upcoming = new Map<string, number>();
}

export class DataRetentionOverview extends AutoEncoder {
    @field({ decoder: DateDecoder })
    calculatedAt = new Date();

    @field({ decoder: new ArrayDecoder(DataRetentionCount) })
    counts: DataRetentionCount[] = [];
}

/**
 * What saving terms would do, counted before they are saved.
 */
export class DataRetentionPreview extends AutoEncoder {
    /**
     * Whether the change waits before it applies. A change that does not wait never erases data sooner, so it needs no confirmation.
     */
    @field({ decoder: BooleanDecoder })
    waits = false;

    /**
     * When the new terms start to apply.
     */
    @field({ decoder: DateDecoder })
    from = new Date();

    /**
     * As counted on the moment the new terms apply. Null when the count did not finish in time, or when the change does not wait.
     */
    @field({ decoder: new ArrayDecoder(DataRetentionCount), nullable: true })
    counts: DataRetentionCount[] | null = null;
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

    /**
     * The counts of the last complete nightly run for this level. Null until a first run completed.
     */
    @field({ decoder: DataRetentionOverview, nullable: true })
    overview: DataRetentionOverview | null = null;
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
export function resolveDataRetentionTerms(
    platform: DataRetentionPolicy | null,
    organization: DataRetentionPolicy | null,
    now: Date,
): ResolvedDataRetentionTerms {
    const platformTerms = platform?.getActiveTerms(now) ?? null;
    const organizationTerms = organization?.getActiveTerms(now) ?? null;

    const anonymizeAfterMonths = getLongest(
        platformTerms?.anonymizeAfterMonths,
        organizationTerms?.anonymizeAfterMonths,
    );
    const deleteAfterMonths = getLongest(
        platformTerms?.deleteAfterMonths,
        organizationTerms?.deleteAfterMonths,
    );
    const deleteExtendedByAnonymize =
        anonymizeAfterMonths !== null &&
        deleteAfterMonths !== null &&
        deleteAfterMonths < anonymizeAfterMonths;

    return {
        anonymizeAfterMonths,
        deleteAfterMonths: deleteExtendedByAnonymize ? anonymizeAfterMonths : deleteAfterMonths,
        protectedPeriods: getLongest(
            platformTerms?.protectedPeriods,
            organizationTerms?.protectedPeriods,
        ),
        deleteExtendedByAnonymize,
    };
}

type ComparableDataRetentionTerms = Pick<
    DataRetentionTerms,
    'anonymizeAfterMonths' | 'deleteAfterMonths' | 'protectedPeriods'
>;

/**
 * Whether a change can erase data sooner, which means it has to wait before it applies.
 *
 * An organization compares its resolved terms. A platform compares its own terms with removedTermIsEarlier,
 * because removing a platform term can make the shorter term of an organization apply.
 */
export function isEarlierDataRetentionDeletion(
    before: ComparableDataRetentionTerms,
    after: ComparableDataRetentionTerms,
    { removedTermIsEarlier = false }: { removedTermIsEarlier?: boolean } = {},
): boolean {
    return (
        isEarlierTerm(
            before.anonymizeAfterMonths,
            after.anonymizeAfterMonths,
            removedTermIsEarlier,
        ) ||
        isEarlierTerm(before.deleteAfterMonths, after.deleteAfterMonths, removedTermIsEarlier) ||
        (before.protectedPeriods !== null &&
            (after.protectedPeriods === null || after.protectedPeriods < before.protectedPeriods))
    );
}

function isEarlierTerm(
    before: number | null,
    after: number | null,
    removedTermIsEarlier: boolean,
): boolean {
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

/**
 * A term in whole years when possible: '2 jaar', '18 maanden'.
 */
export function formatDataRetentionMonths(months: number): string {
    if (months % 12 === 0) {
        return $t('{count} jaar', { count: months / 12 });
    }
    return months === 1 ? $t('1 maand') : $t('{count} maanden', { count: months });
}

/**
 * What applies to a category, in one line: 'Anonimiseren na 2 jaar · verwijderen na 5 jaar'.
 */
export function getDataRetentionTermsSummary(
    terms: Pick<ResolvedDataRetentionTerms, 'anonymizeAfterMonths' | 'deleteAfterMonths'>,
): string {
    const parts: string[] = [];
    if (terms.anonymizeAfterMonths !== null) {
        parts.push(
            $t('Anonimiseren na {term}', {
                term: formatDataRetentionMonths(terms.anonymizeAfterMonths),
            }),
        );
    }
    if (terms.deleteAfterMonths !== null) {
        const term = formatDataRetentionMonths(terms.deleteAfterMonths);
        parts.push(
            parts.length === 0
                ? $t('Verwijderen na {term}', { term })
                : $t('verwijderen na {term}', { term }),
        );
    }
    if (parts.length === 0) {
        return $t('Geen termijn: blijft bewaard');
    }
    return parts.join(' · ');
}

/**
 * For an organization within a platform: whose term applies.
 */
export function getDataRetentionSourceDescription(
    platform: DataRetentionPolicy,
    organization: DataRetentionPolicy,
    now: Date,
): string {
    const platformTerms = platform.getActiveTerms(now);
    const organizationTerms = organization.getActiveTerms(now);
    const actions = ['anonymizeAfterMonths', 'deleteAfterMonths'] as const;

    const hasOwnTerm = actions.some((action) => organizationTerms[action] !== null);
    if (!hasOwnTerm) {
        return actions.some((action) => platformTerms[action] !== null)
            ? $t('Termijn van de koepel. Jullie stelden niets in.')
            : $t('Jullie stelden niets in, en de koepel ook niet.');
    }

    const isOverruled = actions.some((action) => {
        const own = organizationTerms[action];
        const platformTerm = platformTerms[action];
        return own !== null && platformTerm !== null && platformTerm > own;
    });
    if (isOverruled) {
        return $t(
            'De koepel bewaart langer, en de langste termijn geldt. Jullie kortere termijn geldt zodra de koepel die verkort.',
        );
    }
    return $t('Jullie termijn. De langste termijn geldt.');
}

/**
 * Why the terms of an organization do not apply as they were filled in, because the platform keeps data longer.
 * These are only messages: an organization can always save its own terms.
 */
export function getDataRetentionConflicts(
    platform: DataRetentionTerms | null,
    organization: DataRetentionTerms,
): string[] {
    if (!platform) {
        return [];
    }
    const conflicts: string[] = [];
    const resolved = resolveDataRetentionTerms(
        DataRetentionPolicy.create({ category: DataRetentionCategory.Members, terms: platform }),
        DataRetentionPolicy.create({
            category: DataRetentionCategory.Members,
            terms: organization,
        }),
        new Date(),
    );

    if (resolved.deleteExtendedByAnonymize && resolved.deleteAfterMonths !== null) {
        conflicts.push(
            $t(
                'Koepel en vereniging samen zouden verwijderen voor er geanonimiseerd wordt. De langste termijn geldt, dus er wordt pas na {term} verwijderd.',
                { term: formatDataRetentionMonths(resolved.deleteAfterMonths) },
            ),
        );
    }

    const shorter = (['anonymizeAfterMonths', 'deleteAfterMonths'] as const).filter((action) => {
        const own = organization[action];
        const platformTerm = platform[action];
        return own !== null && platformTerm !== null && platformTerm > own;
    });
    if (shorter.length > 0) {
        conflicts.push(
            $t(
                'De koepel bewaart langer ({terms}). De langste termijn geldt, dus jullie kortere termijn heeft nu geen effect. Hij geldt zodra de koepel haar termijn verkort.',
                { terms: getDataRetentionTermsSummary(platform).toLocaleLowerCase() },
            ),
        );
    }

    if (
        organization.protectedPeriods !== null &&
        platform.protectedPeriods !== null &&
        platform.protectedPeriods > organization.protectedPeriods
    ) {
        conflicts.push(
            $t(
                'De koepel beschermt de laatste {count} werkjaren. Het hoogste aantal geldt. Jullie aantal geldt zodra de koepel dat verlaagt.',
                { count: platform.protectedPeriods },
            ),
        );
    }
    return conflicts;
}

/**
 * What happens to a category, as a title: 'Leden anonimiseren'.
 */
export function getDataRetentionActionTitle(
    category: DataRetentionCategory,
    action: DataRetentionAction,
): string {
    switch (category) {
        case DataRetentionCategory.Members:
            return action === DataRetentionAction.Delete
                ? $t('Leden verwijderen')
                : $t('Leden anonimiseren');
        case DataRetentionCategory.SensitiveData:
            return $t('Gevoelige gegevens wissen');
        case DataRetentionCategory.Documents:
            return $t('Documenten verwijderen');
        case DataRetentionCategory.Accounts:
            return $t('Accounts verwijderen');
        case DataRetentionCategory.Orders:
            return $t('Bestellingen anonimiseren');
        case DataRetentionCategory.Emails:
            return $t('E-mails verwijderen');
        case DataRetentionCategory.AuditLogs:
            return $t('Logboekregels verwijderen');
    }
}

/**
 * What the confirmation before saving says, or null when saving needs no confirmation:
 * a change that does not wait, or a count that found nothing the change would process.
 */
export function getDataRetentionPreviewMessage(
    preview: DataRetentionPreview,
): { title: string; description: string } | null {
    if (!preview.waits) {
        return null;
    }
    const date = Formatter.date(preview.from, true);
    const waiting = $t(
        'Je hebt {days} dagen om dit te herzien en te annuleren. Wat daarna verwerkt is, kan je niet ongedaan maken.',
        { days: DATA_RETENTION_WAITING_DAYS },
    );

    if (!preview.counts) {
        return {
            title: $t('Deze termijn gaat in op {date}', { date }),
            description:
                $t(
                    'We konden niet meteen berekenen hoeveel gegevens dit raakt. Het overzicht toont de aantallen na de volgende nachtelijke telling, ruim voor de termijn ingaat.',
                ) +
                ' ' +
                waiting,
        };
    }

    const lines: string[] = [];
    for (const count of preview.counts) {
        const title = getDataRetentionActionTitle(count.category, count.action);
        // Every month bucket is within the year after the terms apply; 'later' is after that
        const nextYear = [...count.upcoming.entries()]
            .filter(([key]) => key !== 'later')
            .reduce((sum, [, amount]) => sum + amount, 0);

        if (count.due > 0 && nextYear > 0) {
            lines.push(
                $t('{title}: {due} vanaf {date}, en nog {later} in het jaar daarna.', {
                    title,
                    due: Formatter.integer(count.due),
                    date,
                    later: Formatter.integer(nextYear),
                }),
            );
        } else if (count.due > 0) {
            lines.push(
                $t('{title}: {due} vanaf {date}.', {
                    title,
                    due: Formatter.integer(count.due),
                    date,
                }),
            );
        } else if (nextYear > 0) {
            lines.push(
                $t('{title}: {later} in het jaar vanaf {date}.', {
                    title,
                    later: Formatter.integer(nextYear),
                    date,
                }),
            );
        }
    }

    if (lines.length === 0) {
        return null;
    }
    return {
        title: $t('Dit heeft gevolgen voor bestaande gegevens'),
        description: lines.join(' ') + ' ' + waiting,
    };
}
