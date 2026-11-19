import type { DataRetentionPolicy, ResolvedDataRetentionTerms } from '@stamhoofd/structures';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionHoldReason,
    resolveDataRetentionTerms,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

export type MemberRetentionFacts = {
    createdAt: Date;
    /**
     * Only used for a member without registrations when there is no platform.
     */
    organizationId: string | null;
    anonymizedAt: Date | null;
    /**
     * Only registrations that were registered. The end date is the deactivation date when that is earlier,
     * and falls back to the end of the group or the period.
     */
    registrations: { organizationId: string; periodId: string; endDate: Date }[];
    /**
     * Without deleted memberships.
     */
    memberships: { organizationId: string; periodId: string; endDate: Date; isCharged: boolean }[];
    hasActiveResponsibility: boolean;
    hasAdminAccount: boolean;
    hasOpenBalance: boolean;
};

export type OrderRetentionFacts = {
    organizationId: string;
    createdAt: Date;
    /**
     * The latest pickup moment or event date of the order, if any.
     */
    eventDate: Date | null;
    anonymizedAt: Date | null;
    hasOpenBalance: boolean;
};

export type DataRetentionDecision = {
    action: DataRetentionAction;
    /**
     * When the term passes. Null when no term applies.
     */
    dueAt: Date | null;
    /**
     * Only filled in once dueAt has passed: the action waits until these are gone.
     */
    heldBy: DataRetentionHoldReason[];
};

type TermsTimeline = { from: Date; terms: ResolvedDataRetentionTerms }[];

/**
 * All policies of a tenant, and the periods needed to know which periods are protected.
 */
export class DataRetentionPolicyIndex {
    constructor(
        private readonly options: {
            /**
             * Null without a platform level, so in userMode organization.
             */
            platform: Map<DataRetentionCategory, DataRetentionPolicy> | null;
            organizations: Map<string, Map<DataRetentionCategory, DataRetentionPolicy>>;
            /**
             * Called for an organization without saved policies, and for the platform without saved policies.
             */
            getDefault: (
                organizationId: string | null,
                category: DataRetentionCategory,
            ) => DataRetentionPolicy;
            currentPeriodIds: Map<string, string>;
            previousPeriodIds: Map<string, string | null>;
        },
    ) {}

    /**
     * The terms that apply from now on, and from each pending change onwards.
     * Without an organization, only the platform applies.
     */
    getTimeline(
        organizationId: string | null,
        category: DataRetentionCategory,
        now: Date,
    ): TermsTimeline {
        const platform = this.options.platform
            ? (this.options.platform.get(category) ?? this.options.getDefault(null, category))
            : null;
        const organization = organizationId
            ? (this.options.organizations.get(organizationId)?.get(category) ??
              this.options.getDefault(organizationId, category))
            : null;

        const moments = [now];
        for (const policy of [platform, organization]) {
            if (policy?.pendingFrom && policy.pendingFrom > now) {
                moments.push(policy.pendingFrom);
            }
        }
        moments.sort((a, b) => a.getTime() - b.getTime());

        return moments.map((from) => ({
            from,
            terms: resolveDataRetentionTerms(platform, organization, from),
        }));
    }

    /**
     * The current period of the organization and the periods before it, as many as protected for members.
     */
    getProtectedPeriodIds(organizationId: string, now: Date): Set<string> {
        const count =
            this.getTimeline(organizationId, DataRetentionCategory.Members, now)[0].terms
                .protectedPeriods ?? 0;
        const periodIds = new Set<string>();

        let periodId = this.options.currentPeriodIds.get(organizationId) ?? null;
        while (periodId && !periodIds.has(periodId) && periodIds.size < count) {
            periodIds.add(periodId);
            periodId = this.options.previousPeriodIds.get(periodId) ?? null;
        }
        return periodIds;
    }
}

export function planMember(
    facts: MemberRetentionFacts,
    index: DataRetentionPolicyIndex,
    now: Date,
): DataRetentionDecision[] {
    if (facts.anonymizedAt) {
        return [planMemberAction(DataRetentionAction.Delete, facts, index, now)];
    }

    return [
        planMemberAction(DataRetentionAction.RemoveSensitiveData, facts, index, now),
        planMemberAction(DataRetentionAction.Anonymize, facts, index, now),
        planMemberAction(DataRetentionAction.Delete, facts, index, now),
    ];
}

export function planOrder(
    facts: OrderRetentionFacts,
    index: DataRetentionPolicyIndex,
    now: Date,
): DataRetentionDecision | null {
    if (facts.anonymizedAt) {
        return null;
    }

    const start =
        facts.eventDate && facts.eventDate > facts.createdAt ? facts.eventDate : facts.createdAt;
    const dueAt = getDueAt(
        [
            {
                start,
                timeline: index.getTimeline(
                    facts.organizationId,
                    DataRetentionCategory.Orders,
                    now,
                ),
            },
        ],
        (terms) => terms.anonymizeAfterMonths,
    );

    return {
        action: DataRetentionAction.Anonymize,
        dueAt,
        heldBy:
            dueAt && dueAt <= now && facts.hasOpenBalance
                ? [DataRetentionHoldReason.OpenBalance]
                : [],
    };
}

/**
 * For the categories that only follow a date: e-mails, documents, the audit log and accounts.
 * They can only be deleted, and nothing holds them: what should be kept is left out of these categories.
 */
export function planDeletion(
    organizationId: string | null,
    category: DataRetentionCategory,
    start: Date,
    index: DataRetentionPolicyIndex,
    now: Date,
): DataRetentionDecision {
    return {
        action: DataRetentionAction.Delete,
        dueAt: getDueAt(
            [{ start, timeline: index.getTimeline(organizationId, category, now) }],
            (terms) => terms.deleteAfterMonths,
        ),
        heldBy: [],
    };
}

function planMemberAction(
    action: DataRetentionAction,
    facts: MemberRetentionFacts,
    index: DataRetentionPolicyIndex,
    now: Date,
): DataRetentionDecision {
    const category =
        action === DataRetentionAction.RemoveSensitiveData
            ? DataRetentionCategory.SensitiveData
            : DataRetentionCategory.Members;
    const getMonths =
        action === DataRetentionAction.Anonymize
            ? (terms: ResolvedDataRetentionTerms) => terms.anonymizeAfterMonths
            : (terms: ResolvedDataRetentionTerms) => terms.deleteAfterMonths;

    const starts = getMemberStarts(facts);
    const dueAt = getDueAt(
        starts.map(({ organizationId, start }) => ({
            start,
            timeline: index.getTimeline(organizationId, category, now),
        })),
        getMonths,
    );

    if (!dueAt || dueAt > now) {
        return { action, dueAt, heldBy: [] };
    }
    return { action, dueAt, heldBy: getMemberHolds(action, facts, index, now) };
}

/**
 * The term starts at the end of the last registration at each organization. Without registrations, it starts when the member was created.
 */
function getMemberStarts(
    facts: MemberRetentionFacts,
): { organizationId: string | null; start: Date }[] {
    if (facts.registrations.length === 0) {
        return [
            {
                organizationId: STAMHOOFD.userMode === 'platform' ? null : facts.organizationId,
                start: facts.createdAt,
            },
        ];
    }

    const lastEndByOrganization = new Map<string, Date>();
    for (const registration of facts.registrations) {
        const current = lastEndByOrganization.get(registration.organizationId);
        if (!current || registration.endDate > current) {
            lastEndByOrganization.set(registration.organizationId, registration.endDate);
        }
    }
    return [...lastEndByOrganization].map(([organizationId, start]) => ({ organizationId, start }));
}

/**
 * The longest term of all organizations applies. If one organization has no term, the action never happens.
 *
 * Each pending change splits time into intervals with their own terms. The action happens in the first interval
 * whose terms make it due before that interval ends.
 */
function getDueAt(
    starts: { start: Date; timeline: TermsTimeline }[],
    getMonths: (terms: ResolvedDataRetentionTerms) => number | null,
): Date | null {
    const moments = [
        ...new Set(starts.flatMap((s) => s.timeline.map((t) => t.from.getTime()))),
    ].sort((a, b) => a - b);

    for (const [i, moment] of moments.entries()) {
        let dueAt: Date | null = null;
        for (const { start, timeline } of starts) {
            const terms = timeline.findLast((t) => t.from.getTime() <= moment)!.terms;
            const months = getMonths(terms);
            if (months === null) {
                dueAt = null;
                break;
            }
            const due = addMonths(start, months);
            if (!dueAt || due > dueAt) {
                dueAt = due;
            }
        }

        if (!dueAt) {
            continue;
        }

        // A change that is still pending cannot apply before it starts
        const happensAt = i === 0 || dueAt.getTime() > moment ? dueAt : new Date(moment);
        const nextMoment = moments[i + 1];
        if (nextMoment === undefined || happensAt.getTime() < nextMoment) {
            return happensAt;
        }
    }
    return null;
}

function getMemberHolds(
    action: DataRetentionAction,
    facts: MemberRetentionFacts,
    index: DataRetentionPolicyIndex,
    now: Date,
): DataRetentionHoldReason[] {
    // A running registration needs no hold: the term only starts at the end of the last registration.
    // Sensitive data follows its own term and is not kept for any other reason.
    if (action === DataRetentionAction.RemoveSensitiveData) {
        return [];
    }

    const holds: DataRetentionHoldReason[] = [];

    if (facts.hasActiveResponsibility) {
        holds.push(DataRetentionHoldReason.ActiveResponsibility);
    }
    if (facts.memberships.some((m) => m.endDate >= now)) {
        holds.push(DataRetentionHoldReason.ActiveMembership);
    }
    if (facts.hasAdminAccount) {
        holds.push(DataRetentionHoldReason.AdminAccount);
    }
    if (facts.hasOpenBalance) {
        holds.push(DataRetentionHoldReason.OpenBalance);
    }

    const protectedPeriodIds = new Map<string, Set<string>>();
    const isProtected = ({
        organizationId,
        periodId,
    }: {
        organizationId: string;
        periodId: string;
    }) => {
        let periodIds = protectedPeriodIds.get(organizationId);
        if (!periodIds) {
            periodIds = index.getProtectedPeriodIds(organizationId, now);
            protectedPeriodIds.set(organizationId, periodIds);
        }
        return periodIds.has(periodId);
    };
    if (facts.registrations.some(isProtected) || facts.memberships.some(isProtected)) {
        holds.push(DataRetentionHoldReason.ProtectedPeriod);
    }

    // The platform still has to charge this membership to the organization.
    if (action === DataRetentionAction.Delete && facts.memberships.some((m) => !m.isCharged)) {
        holds.push(DataRetentionHoldReason.UnchargedMembership);
    }

    return holds;
}

/**
 * In Belgian time, so a date at midnight stays on the same day of the month.
 * Clamps to the end of the month: 31 August plus 6 months is 28 February, not 3 March.
 */
function addMonths(date: Date, months: number): Date {
    return DateTime.fromJSDate(date, { zone: Formatter.timezone }).plus({ months }).toJSDate();
}
